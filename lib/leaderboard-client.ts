type ClassName = "4A" | "4B" | "4C";
type Player = { className: ClassName; studentNo: number };
type Rank = Player & { completed: number; rank: number };
type Answer = Player & { dividend: number; divisor: number; quotient: number; remainder: number; attemptId: string };

declare global {
  interface Window {
    __DIVISION_SUPABASE__?: { url: string; key: string };
  }
}

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const config = window.__DIVISION_SUPABASE__;
  if (!config) throw new Error("排行榜尚未設定");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: config.key, "content-type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error("排行榜暫時未能連線，請稍後再試。");
  return response;
}

export async function getLeaderboard(player?: Player | null): Promise<{ rankings: Rank[]; ownCompleted: number }> {
  if (!window.__DIVISION_SUPABASE__) {
    const query = player ? `?class=${player.className}&student=${player.studentNo}` : "";
    const response = await fetch(`/api/leaderboard${query}`, { cache: "no-store" });
    if (!response.ok) throw new Error("排行榜暫時未能載入");
    return response.json();
  }
  const response = await supabaseRequest("rpc/division_leaderboard", { method: "POST", body: "{}" });
  const rows = await response.json() as { class_name: ClassName; student_no: number; completed: number }[];
  const rankings = rows.map((row, index) => ({
    className: row.class_name,
    studentNo: row.student_no,
    completed: Number(row.completed),
    rank: index + 1,
  }));
  return { rankings, ownCompleted: rankings.find((row) => row.className === player?.className && row.studentNo === player.studentNo)?.completed ?? 0 };
}

export async function submitAnswer(answer: Answer): Promise<{ completed: number }> {
  if (!window.__DIVISION_SUPABASE__) {
    const response = await fetch("/api/leaderboard", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(answer),
    });
    const data = await response.json() as { error?: string; completed?: number };
    if (!response.ok) throw new Error(data.error || "現在未能儲存分數，請稍後再試。");
    return { completed: data.completed ?? 0 };
  }
  // Database CHECK constraints independently verify the quotient and remainder.
  await supabaseRequest("division_attempts?on_conflict=attempt_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      attempt_id: answer.attemptId,
      class_name: answer.className,
      student_no: answer.studentNo,
      dividend: answer.dividend,
      divisor: answer.divisor,
      quotient: answer.quotient,
      remainder: answer.remainder,
    }),
  });
  const leaderboard = await getLeaderboard(answer);
  return { completed: leaderboard.ownCompleted };
}
