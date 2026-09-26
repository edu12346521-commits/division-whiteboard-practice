"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Lightbulb, Medal, PenLine, RotateCw, Sparkles, Trophy } from "lucide-react";

type ClassName = "4A" | "4B" | "4C";
type Step = { partial: number; quotientDigit: number; product: number; remainder: number };
type Player = { className: ClassName; studentNo: number };
type Rank = Player & { completed: number; rank: number };
type InkPoint = { x: number; y: number };
type InkStroke = InkPoint[];

const classes: ClassName[] = ["4A", "4B", "4C"];
const seats = Array.from({ length: 25 }, (_, i) => i + 1);

function makeProblem(level = 1) {
  const dividend = 100 + Math.floor(Math.random() * 900);
  const ranges: Array<[number, number]> = [[10, 39], [40, 69], [70, 99], [10, 99]];
  const [minimumDivisor, maximumDivisor] = ranges[Math.min(level - 1, 3)];
  const divisor = minimumDivisor + Math.floor(Math.random() * (maximumDivisor - minimumDivisor + 1));
  const text = String(dividend);
  const firstLength = text.split("").findIndex((_, index) => Number(text.slice(0, index + 1)) >= divisor) + 1;
  const steps: Step[] = [];
  let remainder = 0;
  for (let index = firstLength - 1; index < text.length; index += 1) {
    const partial = index === firstLength - 1 ? Number(text.slice(0, firstLength)) : remainder * 10 + Number(text[index]);
    const quotientDigit = Math.floor(partial / divisor);
    const product = quotientDigit * divisor;
    remainder = partial - product;
    steps.push({ partial, quotientDigit, product, remainder });
  }
  const attemptId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { dividend, divisor, steps, attemptId };
}

function readPlayer(): Player | null {
  try {
    const value = localStorage.getItem("division-player");
    if (!value) return null;
    const player = JSON.parse(value) as Player;
    return classes.includes(player.className) && Number.isInteger(player.studentNo) && player.studentNo >= 1 && player.studentNo <= 25 ? player : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [pickedClass, setPickedClass] = useState<ClassName | "">("");
  const [pickedNo, setPickedNo] = useState<number | null>(null);
  const [problem, setProblem] = useState<ReturnType<typeof makeProblem> | null>(null);
  const [answer, setAnswer] = useState({ quotient: "", remainder: "" });
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: "good" | "retry" | "error"; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [rankings, setRankings] = useState<Rank[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoresUnavailable, setScoresUnavailable] = useState(false);
  const [completed, setCompleted] = useState(0);
  const level = Math.floor(completed / 5) + 1;
  const levelProgress = completed % 5;
  const levelName = level === 1 ? "起步小勇者" : level === 2 ? "乘減探險家" : level === 3 ? "餘數高手" : "除法大師挑戰";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const strokesRef = useRef<InkStroke[]>([]);
  const drawingRef = useRef(false);
  const scoreRequestRef = useRef(0);

  useEffect(() => {
    const savedPlayer = readPlayer();
    setPlayer(savedPlayer);
  }, []);

  const fetchRankings = useCallback(async (currentPlayer?: Player | null) => {
    const requestNumber = ++scoreRequestRef.current;
    try {
      const query = currentPlayer ? `?class=${currentPlayer.className}&student=${currentPlayer.studentNo}` : "";
      const response = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("leaderboard");
      const data = (await response.json()) as { rankings: Rank[]; ownCompleted?: number };
      if (requestNumber !== scoreRequestRef.current) return;
      setRankings(data.rankings);
      setScoresUnavailable(false);
      // Restore a returning player's current level before choosing their first question.
      if (currentPlayer && typeof data.ownCompleted === "number") {
        const score = data.ownCompleted;
        setCompleted(score);
        setProblem((current) => current ?? makeProblem(Math.floor(score / 5) + 1));
      }
    } catch {
      if (requestNumber !== scoreRequestRef.current) return;
      setScoresUnavailable(true);
      if (currentPlayer) setProblem((current) => current ?? makeProblem(1));
    } finally {
      if (requestNumber === scoreRequestRef.current) setScoresLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRankings(player); }, [fetchRankings, player]);

  useEffect(() => {
    type BrowserTool = {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean };
      execute: (input: unknown) => unknown | Promise<unknown>;
    };
    const modelContext = (document as Document & { modelContext?: { registerTool?: (tool: BrowserTool, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const reportError = (error: unknown) => console.error("除法小白板工具註冊失敗", error);
    const register = (tool: BrowserTool) => {
      try { void Promise.resolve(modelContext.registerTool?.(tool, { signal: lifecycle.signal })).catch(reportError); }
      catch (error) { reportError(error); }
    };
    register({
      name: "read_division_leaderboard",
      title: "查看四年級排行榜",
      description: "讀取四年級所有學生按完成題數排列的除法排行榜。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      async execute() {
        const response = await fetch("/api/leaderboard", { cache: "no-store" });
        if (!response.ok) throw new Error("排行榜暫時未能載入");
        return response.json();
      },
    });
    register({
      name: "start_division_practice",
      title: "開始除法練習",
      description: "為指定班別和學號開始一題新的三位數除兩位數練習，並更新畫面。",
      inputSchema: {
        type: "object",
        properties: { className: { type: "string", enum: classes }, studentNo: { type: "integer", minimum: 1, maximum: 25 } },
        required: ["className", "studentNo"],
        additionalProperties: false,
      },
      execute(input) {
        const value = input as { className?: unknown; studentNo?: unknown };
        if (!classes.includes(value.className as ClassName) || !Number.isInteger(value.studentNo) || Number(value.studentNo) < 1 || Number(value.studentNo) > 25) throw new Error("請選擇 4A–4C 班和 1–25 號學號");
        const nextPlayer: Player = { className: value.className as ClassName, studentNo: Number(value.studentNo) };
        const nextProblem = makeProblem();
        localStorage.setItem("division-player", JSON.stringify(nextPlayer));
        setPlayer(nextPlayer);
        setProblem(nextProblem);
        setAnswer({ quotient: "", remainder: "" });
        setFeedback(null);
        setHintLevel(0);
        strokesRef.current = [];
        return { className: nextPlayer.className, studentNo: nextPlayer.studentNo, dividend: nextProblem.dividend, divisor: nextProblem.divisor, status: "started" };
      },
    });
    return () => lifecycle.abort();
  }, []);

  const paintBoard = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = boardRef.current;
    if (!canvas || !wrap) return;
    const bounds = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, bounds.width, bounds.height);
    context.strokeStyle = "#e8edf2";
    context.lineWidth = 1;
    for (let x = 22; x < bounds.width; x += 28) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, bounds.height); context.stroke();
    }
    for (let y = 22; y < bounds.height; y += 28) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(bounds.width, y); context.stroke();
    }
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1749b4";
    context.lineWidth = 3.3;
    for (const stroke of strokesRef.current) {
      if (stroke.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke[0].x * bounds.width, stroke[0].y * bounds.height);
      for (const point of stroke.slice(1)) context.lineTo(point.x * bounds.width, point.y * bounds.height);
      context.stroke();
    }
  }, []);

  useEffect(() => {
    const wrap = boardRef.current;
    if (!wrap) return;
    paintBoard();
    const observer = new ResizeObserver(paintBoard);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [paintBoard, player, problem]);

  const newQuestion = () => {
    const next = makeProblem(level);
    setProblem(next);
    setAnswer({ quotient: "", remainder: "" });
    setFeedback(null);
    setHintLevel(0);
    strokesRef.current = [];
  };

  const startPlaying = () => {
    if (!pickedClass || !pickedNo) return;
    const nextPlayer = { className: pickedClass, studentNo: pickedNo };
    localStorage.setItem("division-player", JSON.stringify(nextPlayer));
    setPlayer(nextPlayer);
    setProblem(null);
    setAnswer({ quotient: "", remainder: "" });
    setHintLevel(0);
    setFeedback(null);
    setCompleted(0);
    setScoresLoading(true);
  };

  const clearBoard = () => { strokesRef.current = []; paintBoard(); };
  const updateAnswer = (field: "quotient" | "remainder", value: string) => {
    setAnswer((current) => ({ ...current, [field]: value.replace(/[^0-9]/g, "").slice(0, 3) }));
    if (feedback?.kind === "retry" || feedback?.kind === "error") setFeedback(null);
  };

  const submitWork = async () => {
    if (!problem || !player || checking || feedback?.kind === "good") return;
    if (answer.quotient === "" || answer.remainder === "") {
      setFeedback({ kind: "retry", text: "填好商和餘數，再檢查答案。沒有餘數就填 0。" });
      return;
    }
    if (Number(answer.quotient) !== Math.floor(problem.dividend / problem.divisor) || Number(answer.remainder) !== problem.dividend % problem.divisor) {
      setFeedback({ kind: "retry", text: "再看看白板上的豎式，商和餘數都要正確。需要幫忙可以按「提示」。" });
      return;
    }
    setChecking(true);
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...player,
          dividend: problem.dividend,
          divisor: problem.divisor,
          attemptId: problem.attemptId,
          quotient: Number(answer.quotient),
          remainder: Number(answer.remainder),
        }),
      });
      const data = await response.json() as { error?: string; completed?: number };
      if (!response.ok) throw new Error(data.error || "現在未能儲存分數，請稍後再試。");
      const quotient = Math.floor(problem.dividend / problem.divisor);
      const completedCount = typeof data.completed === "number" ? data.completed : completed + 1;
      const levelPassed = completedCount > 0 && completedCount % 5 === 0;
      setFeedback({ kind: "good", text: levelPassed
        ? `答對了！${problem.dividend} ÷ ${problem.divisor} = ${quotient} 餘 ${answer.remainder}。第 ${completedCount / 5} 關完成，下一關已解鎖！`
        : `答對了！${problem.dividend} ÷ ${problem.divisor} = ${quotient} 餘 ${answer.remainder}。再答對幾題就能通過這一關！` });
      setCompleted(completedCount);
      void fetchRankings(player);
    } catch (error) {
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "連線失敗，請保留答案再試。" });
    } finally { setChecking(false); }
  };

  const myRank = useMemo(() => player ? rankings.find((item) => item.className === player.className && item.studentNo === player.studentNo)?.rank : null, [player, rankings]);
  const hints = useMemo(() => problem ? [
    "先從被除數左邊開始，找最少的數字，讓它大於或等於除數。",
    `先想想 ${problem.steps[0].partial} ÷ ${problem.divisor}。找一個商，使「商 × ${problem.divisor}」不會超過 ${problem.steps[0].partial}。`,
    "每次算出乘積後相減，再把下一位數字放下來，繼續計算。",
  ] : [], [problem]);

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    strokesRef.current.push([{ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height }]);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    paintBoard();
  };
  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    strokesRef.current[strokesRef.current.length - 1].push({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
    paintBoard();
  };

  return (
    <main className="min-h-screen bg-[#f3f6fb] text-[#17243c]">
      <header className="topbar">
        <a className="brand" href="/" aria-label="除法小白板首頁"><span className="brand-mark"><span>÷</span></span><span>除法小白板</span></a>
        <div className="topbar-right">
          {player && <span className="student-chip"><span className="student-dot" />{player.className} · {player.studentNo} 號</span>}
          <span className="grade-chip">四年級數學</span>
        </div>
      </header>

      {!player ? (
        <section className="entry-screen">
          <div className="entry-main">
            <div className="eyebrow"><PenLine size={15} /> 今日練習</div>
            <h1>準備好，<br /><span>一步一步算。</span></h1>
            <p className="entry-copy">先選班別和學號。在白板寫好豎式，再填商和餘數；答對就能獲得星星！</p>
            <div className="picker-card">
              <label className="field-label" id="class-label">班別</label>
              <div className="class-picker" role="group" aria-labelledby="class-label">
                {classes.map((name) => <button type="button" key={name} onClick={() => setPickedClass(name)} className={`class-option ${pickedClass === name ? "is-selected" : ""}`} aria-pressed={pickedClass === name}>{name}</button>)}
              </div>
              <div className="student-picker-head"><span className="field-label" id="number-label">學號</span><span className="selection-hint">{pickedNo ? `已選 ${pickedNo} 號` : "選擇 1–25 號"}</span></div>
              <div className="number-grid" role="group" aria-labelledby="number-label">
                {seats.map((number) => <button key={number} type="button" onClick={() => setPickedNo(number)} className={`number-option ${pickedNo === number ? "is-selected" : ""}`} aria-pressed={pickedNo === number}>{number}</button>)}
              </div>
              <button type="button" className="primary-button start-button" disabled={!pickedClass || !pickedNo} onClick={startPlaying}>開始練習 <span aria-hidden="true">→</span></button>
            </div>
          </div>
          <div className="entry-preview" aria-label="豎式除法練習預覽">
            <div className="preview-label"><span>白板預覽</span><span className="live-dot" /></div>
            <div className="preview-problem"><span>隨機題型</span><strong>□□□ <i>÷</i> □□</strong></div>
            <div className="preview-rule" />
            <div className="preview-lines"><span className="preview-board-note">拿起筆，在白板上完成你的豎式。</span><span className="preview-blue">每答對 5 題，就能解鎖新關卡！</span></div>
            <div className="preview-note"><Lightbulb size={15} /> 需要幫忙時，再按「提示」</div>
            <img className="preview-mascot" src="/pencil-buddy.webp" alt="" aria-hidden="true" />
          </div>
        </section>
      ) : (
        <div className="workspace">
          <section className="practice-column">
            <div className="practice-heading">
              <div><div className="eyebrow">豎式練習 <span className="eyebrow-divider">/</span> 第 {feedback?.kind === "good" ? completed : completed + 1} 題</div><h1>寫好豎式，填上答案！</h1></div>
              <div className="score-pill"><Sparkles size={16} /><span>已完成 <b>{completed}</b> 題</span></div>
            </div>
            <div className="problem-card">
              <div className="problem-copy"><span className="problem-caption">請計算</span><div className="problem-math"><span>{problem?.dividend ?? "—"}</span><span className="divide-sign">÷</span><span>{problem?.divisor ?? "—"}</span><span className="question-mark">= ?</span></div></div>
              <div className="problem-hint-wrap">
                <button
                  type="button"
                  className="hint-button"
                  aria-expanded={hintLevel > 0}
                  aria-controls="division-hint"
                  onClick={() => setHintLevel((current) => current >= 3 ? 0 : current + 1)}
                >
                  <Lightbulb size={16} />{hintLevel === 0 ? "提示" : hintLevel === 3 ? "收起提示" : "更多提示"}
                </button>
                {hintLevel > 0 && <div className="hint-panel" id="division-hint" role="status"><span className="hint-index">提示 {hintLevel} / 3</span>{hints[hintLevel - 1]}</div>}
              </div>
            </div>
            <section className="level-card" aria-label={`第 ${level} 關進度`}>
              <div className="level-badge"><Trophy size={18} /></div>
              <div className="level-copy"><strong>第 {level} 關・{levelName}</strong><span>{level <= 3 ? `除數挑戰：${level === 1 ? "10–39" : level === 2 ? "40–69" : "70–99"}` : "除數隨機挑戰：10–99"}</span></div>
              <div className="level-meter" role="progressbar" aria-label="本關進度" aria-valuemin={0} aria-valuemax={5} aria-valuenow={levelProgress}>
                <div className="level-stars">{Array.from({ length: 5 }, (_, index) => <span key={index} className={`level-star ${index < levelProgress ? "earned" : ""}`}>★</span>)}</div>
                <span className="level-count">{levelProgress} / 5</span>
              </div>
            </section>
            <section className="board-card" aria-label="計算白板">
              <div className="board-toolbar"><div className="board-title"><span className="board-live" />計算白板 <span className="board-helper">用滑鼠或手指書寫</span></div><button type="button" className="tool-button" onClick={clearBoard}><Eraser size={15} />清除</button></div>
              <div className="board-canvas-wrap" ref={boardRef}><canvas ref={canvasRef} aria-label="自由書寫白板" onPointerDown={startStroke} onPointerMove={continueStroke} onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }} /></div>
              <div className="steps-area">
                <div className="steps-header"><span className="steps-label">寫完豎式了嗎？填上答案</span></div>
                <div className="answer-fields">
                  <label className="answer-field">商<input inputMode="numeric" pattern="[0-9]*" aria-label="商" value={answer.quotient} onChange={(event) => updateAnswer("quotient", event.target.value)} placeholder="填寫商" disabled={feedback?.kind === "good"} /></label>
                  <label className="answer-field">餘數<input inputMode="numeric" pattern="[0-9]*" aria-label="餘數" value={answer.remainder} onChange={(event) => updateAnswer("remainder", event.target.value)} placeholder="填寫餘數" disabled={feedback?.kind === "good"} /></label>
                </div>
                <div className="remainder-note">沒有餘數就填 0。需要幫忙時，按題目旁的「提示」。</div>
                {feedback && <div className={`feedback feedback-${feedback.kind}`} role="status">{feedback.kind === "good" ? <Trophy size={18} /> : <span className="feedback-mark">{feedback.kind === "retry" ? "↺" : "!"}</span>}<span>{feedback.text}</span></div>}
                <div className="board-actions"><button type="button" className="primary-button check-button" onClick={submitWork} disabled={checking || feedback?.kind === "good"}>{checking ? "正在驗算…" : "檢查答案"}<span aria-hidden="true">→</span></button>{feedback?.kind === "good" && <button type="button" className="next-button" onClick={newQuestion}><RotateCw size={16} />下一題</button>}</div>
              </div>
            </section>
          </section>

          <aside className="leaderboard-card" aria-label="四年級排行榜">
            <div className="mascot-banner"><img src="/pencil-buddy.webp" alt="" aria-hidden="true" /><div><strong>一起闖關吧！</strong><span>寫好豎式，拿下星星 ✨</span></div></div>
            <div className="leaderboard-head"><div className="leaderboard-icon"><Trophy size={19} /></div><div><div className="eyebrow">一起努力</div><h2>全級排行榜</h2></div><span className="rank-count">{rankings.length} 人</span></div>
            <p className="leaderboard-sub">按完成題數排列</p>
            {myRank && <div className="my-rank"><div><span className="my-rank-label">你的排名</span><strong>第 {myRank} 名</strong></div><span className="my-rank-score">{completed} 題</span></div>}
            <div className="ranking-list">
              {scoresLoading ? <div className="list-message">載入排行榜…</div> : scoresUnavailable ? <div className="list-message">排行榜暫時未能載入。完成題目後會自動重試。</div> : rankings.length === 0 ? <div className="list-message">第一個完成題目的同學，會出現在這裡。</div> : rankings.map((item) => <div className={`ranking-row ${player && player.className === item.className && player.studentNo === item.studentNo ? "is-me" : ""}`} key={`${item.className}-${item.studentNo}`}><span className={`rank-number ${item.rank <= 3 ? `rank-${item.rank}` : ""}`}>{item.rank <= 3 ? <Medal size={16} /> : item.rank}</span><span className="rank-name">{item.className} <b>{item.studentNo}</b> 號</span><span className="rank-score">{item.completed}<small> 題</small></span></div>)}
            </div>
            <div className="leaderboard-foot"><span>每答對一題，就累積一題</span><button type="button" onClick={() => void fetchRankings(player)} aria-label="重新整理排行榜"><RotateCw size={14} /></button></div>
          </aside>
        </div>
      )}
      <footer className="page-foot"><span>每一步都算數。</span>{player && <button type="button" onClick={() => { localStorage.removeItem("division-player"); setPlayer(null); setProblem(null); setPickedClass(""); setPickedNo(null); setCompleted(0); }}>更換學生</button>}</footer>
    </main>
  );
}
