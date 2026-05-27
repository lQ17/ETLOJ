import { Typography } from "@arco-design/web-react";

interface StepInfoProps {
  message?: string;
}

export default function StepInfo({ message }: StepInfoProps) {
  if (!message) return null;

  return (
    <div
      style={{
        textAlign: "center",
        padding: "8px 16px",
        fontSize: 14,
        color: "var(--color-text-2)",
        minHeight: 36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography.Text style={{ color: "inherit" }}>{message}</Typography.Text>
    </div>
  );
}
