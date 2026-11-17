"""Tahap 7 - Aplikasi web interaktif (Flask) Manajemen Energi Rumah Pintar dengan Q-Learning."""
import json, os, sys, uuid, threading
import numpy as np
from flask import Flask, jsonify, render_template, request

BASE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(BASE)
sys.path.insert(0, os.path.join(ROOT, "src"))
from qlearning import *

app = Flask(__name__)
ENV, DATES, IDX = load_split(os.path.join(ROOT, "data", "processed", "daily_matrix.npz"))
RES = os.path.join(ROOT, "results")
RESULTS = json.load(open(os.path.join(RES, "experiment_results.json")))
PRE = json.load(open(os.path.join(RES, "preprocess_summary.json")))
CURVE = json.load(open(os.path.join(RES, "learning_curve.json")))
Q_BEST = np.load(os.path.join(RES, "Q_table_best.npy"))
MODELS = {"best": Q_BEST}                    # id -> Q-table (model terbaik + model hasil latihan pengguna)
LOCK = threading.Lock()
MAX_EPISODES = 30000
POLICIES = {"normal": policy_normal, "rule": policy_rule}

def get_policy(name, qid):
    if name in POLICIES: return POLICIES[name]
    Q = MODELS.get(qid)
    if Q is None: return None
    return make_greedy_policy(Q)

def metrics_split(policy):
    return {sp: evaluate(ENV, IDX[sp], policy) for sp in ["val", "test"]}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/summary")
def summary():
    import csv
    def rd(f):
        with open(os.path.join(RES, f), encoding="utf8") as fh: return list(csv.DictReader(fh))
    q_test = {k: float(np.mean([f["test"][k] for f in RESULTS["final"]])) for k in RESULTS["final"][0]["test"]}
    return jsonify(dict(pre=PRE, split=RESULTS["split"], best_cfg=RESULTS["best_cfg"], asumsi=RESULTS["asumsi"], baseline=RESULTS["baseline"],
                        q_test_mean=q_test, curve=CURVE["curve"], grid=rd("grid_hyperparameter.csv"), ablation=rd("ablation_hyperparameter.csv"),
                        test_days=[str(DATES[i]) for i in IDX["test"]], val_days=[str(DATES[i]) for i in IDX["val"]], price=PRICE,
                        peak=list(PEAK_HOURS), offpeak=list(OFFPEAK_HOURS), best_seed=RESULTS["best_seed"]))

@app.route("/api/day")
def day():
    date = request.args.get("date", ""); name = request.args.get("policy", "q"); qid = request.args.get("qid", "best")
    ds = list(map(str, DATES))
    if date not in ds: return jsonify(error="Tanggal tidak ada dalam data."), 400
    pol = get_policy(name if name != "q" else "q", qid)
    if pol is None: return jsonify(error="Model tidak ditemukan."), 400
    di = ds.index(date)
    out = {}
    for nm, p in [("normal", policy_normal), ("rule", policy_rule), ("q", get_policy("q", qid))]:
        tot, traj = run_day(ENV, di, p); out[nm] = dict(total=tot, traj=traj)
    split = "train" if di in IDX["train"] else ("val" if di in IDX["val"] else "test")
    return jsonify(date=date, split=split, actions=ACTIONS, result=out, price=PRICE)

@app.route("/api/train", methods=["POST"])
def train_api():
    b = request.get_json(force=True)
    try:
        cfg = dict(alpha=float(b.get("alpha", 0.5)), gamma=float(b.get("gamma", 0.99)), eps_decay=float(b.get("eps_decay", 0.9999)),
                   alpha_decay=float(b.get("alpha_decay", 0.05)))
        episodes = int(b.get("episodes", 5000)); seed = int(b.get("seed", 1))
        assert 0 < cfg["alpha"] <= 1 and 0 <= cfg["gamma"] < 1 and 0.9 <= cfg["eps_decay"] <= 1 and 0 <= cfg["alpha_decay"] <= 1
    except Exception:
        return jsonify(error="Parameter tidak valid."), 400
    episodes = max(100, min(episodes, MAX_EPISODES))
    Q, ret, cur = train(ENV, IDX["train"], seed=seed, episodes=episodes, eval_days=IDX["val"], eval_every=max(100, episodes//20), **cfg)
    qid = uuid.uuid4().hex[:8]
    with LOCK:
        if len(MODELS) > 20: MODELS.pop(next(k for k in MODELS if k != "best"))
        MODELS[qid] = Q
    m = metrics_split(make_greedy_policy(Q))
    return jsonify(qid=qid, episodes=episodes, cfg=cfg, curve=cur, metrics=m, baseline=RESULTS["baseline"],
                   returns=[float(np.mean(ret[i:i+max(1, episodes//100)])) for i in range(0, episodes, max(1, episodes//100))])

@app.route("/api/policy")
def policy_map():
    qid = request.args.get("qid", "best"); dl = int(request.args.get("demand", 1)); ll = int(request.args.get("ctrl", 1))
    Q = MODELS.get(qid)
    if Q is None or dl not in (0, 1, 2) or ll not in (0, 1, 2): return jsonify(error="Parameter tidak valid."), 400
    M = [[int(np.argmax(Q[((h*3 + dl)*3 + ll)*4 + b])) for h in range(24)] for b in range(4)]
    Qv = [[[float(x) for x in Q[((h*3 + dl)*3 + ll)*4 + b]] for h in range(24)] for b in range(4)]
    return jsonify(map=M, q=Qv, actions=ACTIONS)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
