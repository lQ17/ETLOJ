import { Button, Select, Space, Slider } from "@arco-design/web-react";
import {
  IconPlayArrow,
  IconPause,
  IconLeft,
  IconRight,
  IconRefresh,
} from "@arco-design/web-react/icon";

const SPEED_OPTIONS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x", value: 1 },
  { label: "2x", value: 2 },
  { label: "4x", value: 4 },
];

interface PlaybackControllerProps {
  status: "idle" | "playing" | "paused";
  currentStep: number;
  totalSteps: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (step: number) => void;
  disabled: boolean;
}

export default function PlaybackController({
  status,
  currentStep,
  totalSteps,
  speed,
  onPlay,
  onPause,
  onPrev,
  onNext,
  onReset,
  onSpeedChange,
  onSeek,
  disabled,
}: PlaybackControllerProps) {
  const isIdle = status === "idle";
  const isPlaying = status === "playing";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        background: "var(--color-bg-2)",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
      }}
    >
      <Space>
        <Button
          size="small"
          icon={<IconRefresh />}
          onClick={onReset}
          disabled={disabled || isIdle}
        />
        <Button
          size="small"
          icon={<IconLeft />}
          onClick={onPrev}
          disabled={disabled || isIdle || currentStep === 0}
        />
        <Button
          type="primary"
          size="small"
          icon={isPlaying ? <IconPause /> : <IconPlayArrow />}
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled || (isIdle && totalSteps === 0)}
        />
        <Button
          size="small"
          icon={<IconRight />}
          onClick={onNext}
          disabled={disabled || isIdle || currentStep >= totalSteps - 1}
        />
      </Space>

      <div style={{ flex: 1, minWidth: 120 }}>
        <Slider
          value={totalSteps > 1 ? currentStep : 0}
          max={Math.max(totalSteps - 1, 1)}
          min={0}
          step={1}
          onChange={(val) => onSeek(val as number)}
          disabled={disabled || totalSteps <= 1}
          showInput={false}
          style={{ margin: 0 }}
        />
      </div>

      <span style={{ fontSize: 13, color: "var(--color-text-3)", minWidth: 70, textAlign: "center" }}>
        {totalSteps > 0 ? `${currentStep + 1} / ${totalSteps}` : "0 / 0"}
      </span>

      <Select
        size="small"
        style={{ width: 72 }}
        value={speed}
        options={SPEED_OPTIONS}
        onChange={(val) => onSpeedChange(val as number)}
      />
    </div>
  );
}
