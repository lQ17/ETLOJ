import { useRef, useEffect } from "react";
import { submissionApi } from "../../../api/submission";

export function useSubmissionWatch(
  setResult: (r: any) => void,
  setSubmitting: (v: boolean) => void,
) {
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const wsRef = useRef<WebSocket | null>(null);

  const watchResult = (submissionId: number) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }

    let isFinished = false;

    // 立即启动 HTTP 轮询，防止竞态（判题可能在 WebSocket 订阅前就完成）
    const poll = async () => {
      try {
        const sub: any = await submissionApi.getOne(submissionId);
        if (isFinished) return;
        setResult(sub);
        if (sub.status !== "PENDING" && sub.status !== "JUDGING") {
          isFinished = true;
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = undefined;
          }
          if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
          }
          setSubmitting(false);
        }
      } catch {
        // ignore
      }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);

    // 同时尝试建立 WebSocket 连接，成功后替代轮询
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/submissions`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isFinished) { ws.close(); return; }
        ws.send(JSON.stringify({ event: "subscribe", data: { submissionId } }));
      };

      ws.onmessage = (event) => {
        try {
          const { event: type, data } = JSON.parse(event.data);
          if (type === "update" && data.id === submissionId && !isFinished) {
            setResult(data);
            if (data.status !== "PENDING" && data.status !== "JUDGING") {
              isFinished = true;
              ws.close();
              wsRef.current = null;
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = undefined;
              }
              setSubmitting(false);
            }
          }
        } catch (e) {
          console.error("解析 WebSocket 消息失败", e);
        }
      };

      ws.onerror = () => {
        // WebSocket 失败，轮询已在运行，无需额外操作
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
      };
    } catch {
      // WebSocket 创建失败，轮询已在运行
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return { watchResult };
}
