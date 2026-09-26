import { env } from "cloudflare:workers";

type ClassName = "4A" | "4B" | "4C";
const validClasses: ClassName[] = ["4A", "4B", "4C"];

type Ranking = { className: ClassName; studentNo: number; completed: number; rank: number };

// Keep the site's existing leaderboard live until Supabase is configured.
function supabaseConfig() {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase has not been configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      "content-type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  return response;
}

async function supabaseRankings(): Promise<Ranking[]> {
  const response = await supabaseRequest("rpc/division_leaderboard", { method: "POST", body: "{}" });
  const rows = await response.json() as { class_name: ClassName; student_no: number; completed: number }[];
  return rows.map((row, index) => ({
    className: row.class_name,
    studentNo: row.student_no,
    completed: Number(row.completed),
    rank: index + 1,
  }));
}

function isValidIdentity(className: unknown, studentNo: unknown): className is ClassName {
  return typeof className === "string" && validClasses.includes(className as ClassName) && Number.isInteger(studentNo) && Number(studentNo) >= 1 && Number(studentNo) <= 25;
}

function unavailable() {
  return Response.json({ error: "排行榜暫時未能連線，請稍後再試。" }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const className = url.searchParams.get("class");
    const studentNo = Number(url.searchParams.get("student"));
    let rankings: Ranking[];
    if (supabaseConfig()) {
      rankings = await supabaseRankings();
    } else {
      if (!env.DB) return unavailable();
      const { results } = await env.DB.prepare(
      `SELECT class_name AS className, student_no AS studentNo, COUNT(*) AS completed
       FROM division_attempts
       GROUP BY class_name, student_no
       ORDER BY completed DESC, class_name ASC, student_no ASC`,
      ).all<{ className: ClassName; studentNo: number; completed: number }>();
      rankings = (results ?? []).map((row, index) => ({ ...row, rank: index + 1 }));
    }
    const own = isValidIdentity(className, studentNo)
      ? rankings.find((row) => row.className === className && row.studentNo === Number(studentNo))
      : undefined;
    return Response.json({ rankings, ownCompleted: own?.completed ?? 0 });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  let payload: {
    className?: unknown;
    studentNo?: unknown;
    dividend?: unknown;
    divisor?: unknown;
    attemptId?: unknown;
    quotient?: unknown;
    remainder?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "提交的答案格式不正確。" }, { status: 400 });
  }

  const { className, studentNo, dividend, divisor, attemptId, quotient, remainder } = payload;
  if (!isValidIdentity(className, studentNo)) {
    return Response.json({ error: "請重新選擇班別和學號。" }, { status: 400 });
  }
  if (!Number.isInteger(dividend) || Number(dividend) < 100 || Number(dividend) > 999 || !Number.isInteger(divisor) || Number(divisor) < 10 || Number(divisor) > 99) {
    return Response.json({ error: "題目資料不正確，請重新出題。" }, { status: 400 });
  }
  if (typeof attemptId !== "string" || !/^[a-zA-Z0-9-]{8,80}$/.test(attemptId)) {
    return Response.json({ error: "作答編號不正確，請重新出題。" }, { status: 400 });
  }

  if (!Number.isInteger(quotient) || !Number.isInteger(remainder)) {
    return Response.json({ error: "請填寫商和餘數。" }, { status: 400 });
  }
  if (quotient !== Math.floor(Number(dividend) / Number(divisor)) || remainder !== Number(dividend) % Number(divisor)) {
    return Response.json({ error: "答案未正確，請再看看白板上的豎式。" }, { status: 400 });
  }

  try {
    if (supabaseConfig()) {
      await supabaseRequest("division_attempts?on_conflict=attempt_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          attempt_id: attemptId,
          class_name: className,
          student_no: studentNo,
          dividend,
          divisor,
          quotient,
          remainder,
        }),
      });
      const rankings = await supabaseRankings();
      const own = rankings.find((row) => row.className === className && row.studentNo === studentNo);
      return Response.json({ saved: true, completed: own?.completed ?? 0 });
    }
    if (!env.DB) return unavailable();
    await env.DB.prepare(
      `INSERT INTO division_attempts (attempt_id, class_name, student_no, dividend, divisor, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(attempt_id) DO NOTHING`,
    ).bind(attemptId, className, Number(studentNo), Number(dividend), Number(divisor), Date.now()).run();
    const own = await env.DB.prepare(
      `SELECT COUNT(*) AS completed FROM division_attempts WHERE class_name = ? AND student_no = ?`,
    ).bind(className, Number(studentNo)).first<{ completed: number }>();
    return Response.json({ saved: true, completed: own?.completed ?? 0 });
  } catch {
    return unavailable();
  }
}
