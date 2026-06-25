import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  ScanLine,
  BarChart3,
  FileText,
  Bot,
  Clock,
  Volume2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Toaster, toast } from "sonner";

function getSignalTypeIcon(type: string) {
  switch (type) {
    case "BUY":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "SELL":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "ARBITRAGE":
      return <Zap className="h-4 w-4 text-yellow-500" />;
    case "MOMENTUM":
      return <Activity className="h-4 w-4 text-blue-500" />;
    default:
      return <BarChart3 className="h-4 w-4 text-gray-500" />;
  }
}

function getSignalTypeColor(type: string) {
  switch (type) {
    case "BUY":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "SELL":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "ARBITRAGE":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "MOMENTUM":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function getPlatformIcon(platform: string) {
  return platform === "polymarket" ? (
    <span className="text-blue-400 font-semibold text-sm">PM</span>
  ) : (
    <span className="text-orange-400 font-semibold text-sm">KS</span>
  );
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("signals");

  const utils = trpc.useUtils();

  const { data: signalStats } = trpc.signals.stats.useQuery();
  const { data: recentSignals } = trpc.signals.list.useQuery({
    limit: 20,
    offset: 0,
  });
  const { data: botStatus } = trpc.bot.status.useQuery();
  const { data: botLogsData } = trpc.signals.logs.useQuery({ limit: 50 });

  const scanMutation = trpc.bot.scan.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(
          `Scan complete! Found ${data.signalsGenerated} signals.`,
          { description: `Markets scanned: ${data.marketsScanned}` }
        );
      } else {
        toast.error("Scan failed", { description: data.error });
      }
      utils.signals.list.invalidate();
      utils.signals.stats.invalidate();
      utils.bot.status.invalidate();
    },
    onError: (err) => {
      toast.error("Scan error", { description: err.message });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">
                  Prediction Market Bot
                </h1>
                <p className="text-sm text-muted-foreground">
                  Polymarket &amp; Kalshi Signal Generator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    botStatus?.isRunning
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-green-400"
                  }`}
                />
                {botStatus?.isRunning ? "Scanning..." : "Idle"}
              </div>
              <Button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending || botStatus?.isRunning}
                size="sm"
              >
                {scanMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ScanLine className="h-4 w-4 mr-2" />
                )}
                Scan Now
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Signals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {signalStats?.total ?? 0}
                </span>
                <Badge variant="secondary" className="text-xs">
                  +{signalStats?.today ?? 0} today
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Confidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {signalStats?.avgConfidence ?? 0}%
                </span>
                <span className="text-xs text-muted-foreground">
                  confidence score
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Markets Scanned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">
                  {botStatus?.totalScanned ?? 0}
                </span>
                <span className="text-xs text-muted-foreground">
                  {botStatus?.polymarketScanned ?? 0} PM /{" "}
                  {botStatus?.kalshiScanned ?? 0} KS
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Last Scan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-lg font-semibold">
                  {timeAgo(botStatus?.lastScanTime)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Platform Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {signalStats?.byPlatform?.map((item) => (
                  <div
                    key={item.platform}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted"
                  >
                    {getPlatformIcon(item.platform)}
                    <span className="text-sm font-medium capitalize">
                      {item.platform}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3">
                {signalStats?.byType?.map((item) => (
                  <Badge
                    key={item.signalType}
                    variant="outline"
                    className={getSignalTypeColor(item.signalType)}
                  >
                    {item.signalType}: {item.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bot Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Scheduler</span>
                <Badge
                  variant={
                    botStatus?.scheduler?.running ? "default" : "secondary"
                  }
                >
                  {botStatus?.scheduler?.running ? "Running" : "Stopped"}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Schedule</span>
                <span className="font-mono text-xs">
                  {botStatus?.scheduler?.schedule || "Every 30m"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Scanning</span>
                <Badge
                  variant={botStatus?.isRunning ? "default" : "secondary"}
                >
                  {botStatus?.isRunning ? "Active" : "Idle"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="signals">
              <BarChart3 className="h-4 w-4 mr-2" />
              Signals
            </TabsTrigger>
            <TabsTrigger value="logs">
              <FileText className="h-4 w-4 mr-2" />
              Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>Recent Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Volume</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentSignals?.items?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center text-muted-foreground py-8"
                        >
                          No signals yet. Run a scan to generate signals.
                        </TableCell>
                      </TableRow>
                    )}
                    {recentSignals?.items?.map((signal) => (
                      <TableRow key={signal.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(signal.platform)}
                            <span className="capitalize text-sm">
                              {signal.platform}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getSignalTypeColor(signal.signalType)}>
                            <span className="flex items-center gap-1">
                              {getSignalTypeIcon(signal.signalType)}
                              {signal.signalType}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[250px] truncate">
                            <span className="text-sm font-medium">
                              {signal.marketTitle}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {(parseFloat(signal.currentPrice) * 100).toFixed(1)}%
                          </span>
                          {signal.targetPrice && (
                            <span className="text-xs text-muted-foreground ml-1">
                              <ArrowRight className="inline h-3 w-3" />
                              {(
                                parseFloat(signal.targetPrice) * 100
                              ).toFixed(1)}
                              %
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${signal.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">
                              {signal.confidence}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Volume2 className="h-3 w-3 text-muted-foreground" />
                            {parseFloat(
                              signal.volume24h || "0"
                            ).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              signal.status === "active"
                                ? "default"
                                : signal.status === "resolved"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {signal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(signal.createdAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Bot Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Level</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {botLogsData?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center text-muted-foreground py-8"
                        >
                          No logs yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {botLogsData?.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge
                            variant={
                              log.level === "error"
                                ? "destructive"
                                : log.level === "signal"
                                ? "default"
                                : log.level === "warn"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {log.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{log.message}</span>
                          {log.details != null && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {typeof log.details === "string"
                                ? log.details
                                : JSON.stringify(log.details as Record<string, unknown>)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(log.createdAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
