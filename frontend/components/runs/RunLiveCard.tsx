"use client";

import { Card, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { formatDuration, formatPercent } from "@/frontend/lib/utils";
import { getModelById } from "@/lib/ai/models";
import type { LiveRunState } from "@/hooks/useLiveRun";

interface RunLiveCardProps {
  state: LiveRunState;
  /** Called with the final runId when the user clicks "View run". */
  onViewRun?: (runId: string) => void;
  /** Called when the user dismisses the completed card. */
  onDismiss?: () => void;
  /** Called to retry after a failure. */
  onRetry?: () => void;
}

function modelLabel(modelId?: string): string {
  if (!modelId) return "";
  return getModelById(modelId)?.displayName ?? modelId;
}

/**
 * Live execution card for the experiment run wizard / detail page. Reflects the
 * real pipeline: running -> completed / partial / failed. Never fabricates.
 */
export function RunLiveCard({ state, onViewRun, onDismiss, onRetry }: RunLiveCardProps) {
  const { phase, progress, final, error, code, elapsedMs } = state;

  const total = progress?.total || 0;
  const completed = progress?.completed || 0;
  const successful = progress?.successful ?? 0;
  const failed = progress?.failed ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (phase === "connecting") {
    return (
      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#C8A96E]" />
              <div>
                <p className="text-sm font-medium text-[#F5F1EB]">Connecting to run serviceâ€¦</p>
                <p className="mt-0.5 text-xs text-stone-400">Preparing the evaluation pipeline</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "running") {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base">Evaluation in progress</CardTitle>
              {progress?.currentModelId && (
                <CardDescription className="mt-1">
                  Running <span className="font-medium text-[#F5F1EB]">{modelLabel(progress.currentModelId)}</span>
                  {progress.currentTestCaseId ? (
                    <>
                      {" "}on <span className="font-mono text-xs text-stone-300">{progress.currentTestCaseId}</span>
                    </>
                  ) : null}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brand" dot>
                Running
              </Badge>
              <span className="font-mono text-xs text-stone-400">{formatDuration(elapsedMs)}</span>
            </div>
          </div>

          <Progress value={completed} max={Math.max(total, 1)} size="md" variant="brand" />

          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-mono text-stone-400">
              {completed}/{total} executions
            </span>
            <div className="flex items-center gap-4">
              <span className="text-success-400">
                <span className="font-mono">{successful}</span> succeeded
              </span>
              {failed > 0 ? (
                <span className="text-danger-400">
                  <span className="font-mono">{failed}</span> failed
                </span>
              ) : null}
              <span className="text-stone-500">{pct}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done" && final) {
    const successRate = final.total > 0 ? final.successful / final.total : 0;
    const avgAccuracy = final.aggregated?.length
      ? final.aggregated.reduce((s, a) => s + a.avgAccuracy, 0) / final.aggregated.length
      : null;

    const isError = final.failed === final.total && final.total > 0;
    const isPartial = !isError && final.failed > 0;
    const body = (
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {isError ? "Run failed" : isPartial ? "Run completed with errors" : "Run completed"}
            </CardTitle>
            <CardDescription className="mt-1">
              {final.total} executions Â· {final.successful} succeeded Â· {final.failed} failed Â·{" "}
              {formatDuration(elapsedMs || 0)}
            </CardDescription>
          </div>
          <Badge variant={isError ? "danger" : isPartial ? "warning" : "success"} dot>
            {isError ? "Failed" : isPartial ? "Partial" : "Completed"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-stone-400">Success rate</p>
            <p className="mt-0.5 font-mono text-[#F5F1EB]">{formatPercent(successRate)}</p>
          </div>
          {avgAccuracy !== null && (
            <div>
              <p className="text-xs text-stone-400">Avg accuracy</p>
              <p className="mt-0.5 font-mono text-[#F5F1EB]">{formatPercent(avgAccuracy)}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-stone-400">Duration</p>
            <p className="mt-0.5 font-mono text-[#F5F1EB]">{formatDuration(elapsedMs)}</p>
          </div>
        </div>

        {isError && (
          <p className="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 text-xs text-danger-300">
            No test case could be executed successfully. Check the run for provider errors.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {onViewRun && final.runId && !isError && (
            <Button size="sm" onClick={() => onViewRun(final.runId)}>
              View run
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Close
            </Button>
          )}
        </div>
      </CardContent>
    );
    return <Card>{body}</Card>;
  }

  if (phase === "error") {
    return (
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-base text-danger-300">Run could not be completed</CardTitle>
              {code && <Badge variant="danger" className="mt-2">{code}</Badge>}
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-danger-500/20 bg-danger-500/5 px-3 py-2 font-mono text-xs text-danger-300 break-words">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onRetry && (
              <Button size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "idle") return null;

  return null;
}