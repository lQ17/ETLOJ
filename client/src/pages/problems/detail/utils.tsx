import { useState } from "react";
import { Button, Message } from "@arco-design/web-react";
import { IconCopy, IconCheck } from "@arco-design/web-react/icon";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      Message.success("复制成功");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Button
      type="secondary"
      size="mini"
      icon={copied ? <IconCheck /> : <IconCopy />}
      onClick={handleCopy}
      style={{
        fontSize: 12,
        height: 24,
        padding: "0 8px",
        borderRadius: 4,
      }}
    >
      {copied ? "已复制" : "复制"}
    </Button>
  );
}

export function parseSamples(md: string): { input: string; output: string }[] {
  const samples: { input: string; output: string }[] = [];
  const inputRegex = /###\s*输入\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;
  const outputRegex = /###\s*输出\s*#\d+[\s\S]*?```[a-zA-Z0-9]*(?:\r?\n)([\s\S]*?)```/g;

  const inputs: string[] = [];
  const outputs: string[] = [];

  let m;
  while ((m = inputRegex.exec(md)) !== null) {
    inputs.push(m[1].trimEnd());
  }
  while ((m = outputRegex.exec(md)) !== null) {
    outputs.push(m[1].trimEnd());
  }

  const len = Math.min(inputs.length, outputs.length);
  for (let i = 0; i < len; i++) {
    samples.push({ input: inputs[i], output: outputs[i] });
  }
  return samples;
}
