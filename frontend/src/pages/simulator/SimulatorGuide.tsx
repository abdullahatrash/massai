import { BookOpen, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[0.95rem] font-semibold text-white">{title}</h3>
      {children}
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[0.68rem] font-bold tabular-nums text-slate-300">
        {number}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <p className="text-[0.82rem] font-medium text-white">{title}</p>
        <div className="text-[0.75rem] leading-relaxed text-slate-400">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[0.72rem] text-amber-200/80">
      {children}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
      <span className="text-[0.7rem] text-slate-500">{label}</span>
      <code className="text-[0.7rem] text-slate-300">{value}</code>
    </div>
  );
}

export function SimulatorGuide() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="sim-panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-400/10 via-purple-500/5 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-indigo-400 to-purple-500" />
        <div className="relative p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-indigo-400/14 text-indigo-200 ring-1 ring-indigo-300/20">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-[1.2rem] font-semibold tracking-tight text-white">
                Admin Guide
              </h2>
              <p className="mt-0.5 text-[0.75rem] text-slate-400">
                How to use the MaaSAI admin console — no code required
              </p>
            </div>
          </div>
        </div>
      </section>

      <ScrollArea className="h-[calc(100vh-14rem)]">
        <div className="space-y-8 pb-12 pr-4">

          {/* What it does */}
          <Section title="What The Admin Console Does">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                "View and manage all active contracts",
                "Create demo contracts from pilot templates",
                "Run scenario playback to push simulated data",
                "Trigger milestones with evidence attachments",
                "Send custom manual payloads",
                "Run multiple sensors concurrently",
                "Monitor live events in real time",
                "Delete demo contracts when done",
              ].map((item) => (
                <div
                  className="flex items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  key={item}
                >
                  <ChevronRight className="mt-0.5 size-3 shrink-0 text-slate-600" />
                  <span className="text-[0.72rem] text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Login */}
          <Section title="Getting Started">
            <div className="space-y-2">
              <p className="text-[0.75rem] text-slate-400">
                Log into the MaaSAI dashboard, then navigate to <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-300">/admin</code>.
              </p>
              <KeyValue label="URL" value="http://localhost:3000/admin" />
              <KeyValue label="Username" value="admin@test.com" />
              <KeyValue label="Password" value="password" />
            </div>
            <Tip>
              The admin console is only available to users with the <strong>admin</strong> role.
            </Tip>
          </Section>

          {/* Create contract */}
          <Section title="Create a Contract">
            <div className="space-y-4">
              <Step number={1} title="Open the create dialog">
                Click the <Badge className="border-white/10 bg-white/[0.06] text-[0.62rem] text-slate-300">New Contract</Badge> button on the Operations Deck.
              </Step>
              <Step number={2} title="Choose a template">
                <p>Pick one of three pilot types:</p>
                <div className="mt-2 grid gap-1.5">
                  <div className="flex items-center gap-2 rounded-md border border-amber-300/15 bg-amber-300/[0.04] px-3 py-1.5">
                    <span className="text-[0.68rem] font-semibold text-amber-200">Factor</span>
                    <span className="text-[0.65rem] text-slate-500">— Forging, machining, quality inspection</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-1.5">
                    <span className="text-[0.68rem] font-semibold text-emerald-200">Tasowheel</span>
                    <span className="text-[0.65rem] text-slate-500">— Precision wheel hub assembly line</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-sky-300/15 bg-sky-300/[0.04] px-3 py-1.5">
                    <span className="text-[0.68rem] font-semibold text-sky-200">E4M</span>
                    <span className="text-[0.65rem] text-slate-500">— Energy transition demonstrator</span>
                  </div>
                </div>
              </Step>
              <Step number={3} title="Fill in contract details">
                Set the product name, quantity, and delivery date. The quantity you enter here is what appears on the buyer dashboard as "planned".
              </Step>
              <Step number={4} title="Review milestones">
                Each template includes pre-configured milestones. You can add, remove, rename, or reschedule them before creating.
              </Step>
              <Step number={5} title="Create">
                Click <strong>Create Contract</strong>. The new contract appears immediately in the sidebar and grid.
              </Step>
            </div>
          </Section>

          {/* Tabs overview */}
          <Section title="The Contract Workspace">
            <p className="text-[0.75rem] text-slate-400">
              Click any contract to open its workspace. There are four tabs:
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                { tab: "Scenarios", desc: "Automated scenario playback — the primary way to push data" },
                { tab: "Manual send", desc: "Build and submit a single custom payload" },
                { tab: "Milestones", desc: "Trigger milestone completions with evidence" },
                { tab: "Sensors", desc: "Run multiple concurrent data streams" },
              ].map(({ tab, desc }) => (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3" key={tab}>
                  <p className="text-[0.78rem] font-medium text-white">{tab}</p>
                  <p className="mt-1 text-[0.68rem] text-slate-500">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Scenario playback */}
          <Section title="Running Scenarios">
            <div className="space-y-4">
              <Step number={1} title="Select a scenario">
                Each pilot type has multiple scenarios (normal flow, delays, quality failures, milestone completions). Click a scenario card to select it.
              </Step>
              <Step number={2} title="Set the speed">
                <p>Use the speed slider:</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                    <p className="text-[0.82rem] font-semibold text-white">1x</p>
                    <p className="text-[0.6rem] text-slate-500">Real-time</p>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                    <p className="text-[0.82rem] font-semibold text-white">10x</p>
                    <p className="text-[0.6rem] text-slate-500">Fast</p>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                    <p className="text-[0.82rem] font-semibold text-white">100x</p>
                    <p className="text-[0.6rem] text-slate-500">Instant</p>
                  </div>
                </div>
              </Step>
              <Step number={3} title="Run">
                Click <strong>Run scenario</strong>. Watch the status and runner output log for progress.
              </Step>
              <Step number={4} title="Controls">
                <p><strong>Pause</strong> — freezes playback mid-step (amber indicator).</p>
                <p><strong>Resume</strong> — continues from the paused step.</p>
                <p><strong>Stop</strong> — aborts playback entirely.</p>
              </Step>
              <Tip>
                Enable <strong>Continuous</strong> mode to loop the scenario indefinitely. A cycle counter shows how many loops have completed. Great for building up data history.
              </Tip>
            </div>
          </Section>

          {/* Manual send */}
          <Section title="Manual Send">
            <div className="space-y-4">
              <Step number={1} title="Pick an update type">
                Choose from PRODUCTION_UPDATE, QUALITY_EVENT, PHASE_CHANGE, or MILESTONE_COMPLETE.
              </Step>
              <Step number={2} title="Edit fields">
                The form shows all fields from the contract&apos;s ingest profile with their current values. Change what you need.
              </Step>
              <Step number={3} title="Send">
                Click <strong>Send update</strong>. The response panel shows the backend&apos;s response or any validation errors.
              </Step>
            </div>
            <Tip>
              Useful for testing specific field combinations, triggering a specific alert, or sending edge-case payloads.
            </Tip>
          </Section>

          {/* Milestones */}
          <Section title="Milestone Triggers">
            <p className="text-[0.75rem] text-slate-400">
              The Milestones tab shows all milestones for the contract. For each pending milestone:
            </p>
            <div className="mt-2 space-y-4">
              <Step number={1} title="Select a milestone">
                Click on any pending milestone to expand it.
              </Step>
              <Step number={2} title="Attach evidence (optional)">
                Add document URLs as evidence for the milestone completion.
              </Step>
              <Step number={3} title="Complete it">
                Click <strong>Complete milestone</strong>. The status updates immediately and the buyer dashboard reflects the change.
              </Step>
            </div>
          </Section>

          {/* Multi-sensor */}
          <Section title="Multi-Sensor Mode">
            <div className="space-y-4">
              <Step number={1} title="Add sensors">
                The Sensors tab starts with one sensor. Click <strong>Add sensor</strong> to create more.
              </Step>
              <Step number={2} title="Configure each sensor">
                Each sensor has its own source ID, scenario, and speed. Configure them independently.
              </Step>
              <Step number={3} title="Start independently">
                Click <strong>Start</strong> on each sensor. They run concurrently with independent controls and cycle counters.
              </Step>
              <Step number={4} title="Stop or remove">
                Stop individual sensors, or remove them with the trash icon.
              </Step>
            </div>
            <Tip>
              Use this to simulate a factory with multiple production lines sending data at different rates.
            </Tip>
          </Section>

          {/* Events */}
          <Section title="Event Stream">
            <p className="text-[0.75rem] text-slate-400">
              Click the <strong>Events</strong> button in the top-right of any contract workspace to open the live event panel.
              It shows server-sent events arriving in real time. The badge pulses green when new events arrive while the panel is closed.
            </p>
          </Section>

          {/* Delete */}
          <Section title="Delete a Contract">
            <p className="text-[0.75rem] text-slate-400">
              Click the <strong>Delete</strong> button in the contract header. A confirmation dialog appears.
              Deleting removes the contract and all its data (milestones, alerts, updates, notifications).
              You are redirected back to the Operations Deck.
            </p>
          </Section>

          {/* Architecture */}
          <Section title="How Everything Connects">
            <div className="space-y-2">
              {[
                {
                  label: "Admin Console",
                  color: "border-amber-400/20 bg-amber-400/[0.04]",
                  text: "Creates demo contracts, sends simulated updates to the v2 ingest API, authenticates as the provider service account via Keycloak.",
                },
                {
                  label: "Keycloak",
                  color: "border-purple-400/20 bg-purple-400/[0.04]",
                  text: "Issues tokens for the provider service account using client_credentials flow. No manual login needed for operator testing.",
                },
                {
                  label: "MaaSAI Backend",
                  color: "border-sky-400/20 bg-sky-400/[0.04]",
                  text: "Validates data against the contract-bound ingest profile. Stores updates, evaluates milestones and alerts, pushes events via SSE.",
                },
                {
                  label: "Consumer Dashboard",
                  color: "border-emerald-400/20 bg-emerald-400/[0.04]",
                  text: "Shows the buyer view of the contract — milestones, alerts, feed, and analytics. Updates in real time via WebSocket.",
                },
              ].map(({ label, color, text }) => (
                <div className={`rounded-lg border px-3 py-2 ${color}`} key={label}>
                  <p className="text-[0.72rem] font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-[0.68rem] text-slate-400">{text}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Test accounts */}
          <Section title="Test Accounts">
            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                    <th className="px-3 py-2 text-left font-medium text-slate-400">Username</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-400">Password</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-400">Role</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-400">Sees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {[
                    { user: "admin@test.com", pass: "password", role: "Admin", sees: "All contracts" },
                    { user: "consumer-factor@test.com", pass: "password", role: "Consumer", sees: "Factor contracts" },
                    { user: "consumer-e4m@test.com", pass: "password", role: "Consumer", sees: "E4M contracts" },
                  ].map(({ user, pass, role, sees }) => (
                    <tr className="hover:bg-white/[0.02]" key={user}>
                      <td className="px-3 py-2 font-mono text-slate-300">{user}</td>
                      <td className="px-3 py-2 font-mono text-slate-500">{pass}</td>
                      <td className="px-3 py-2 text-slate-400">{role}</td>
                      <td className="px-3 py-2 text-slate-400">{sees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Demo sequence */}
          <Section title="Recommended Demo Sequence">
            <div className="space-y-2">
              {[
                "Open the admin console at /admin",
                "Click New Contract and pick Factor",
                "Set quantity to 500 and a future delivery date",
                "Create the contract",
                "Open the new contract from the grid",
                "Go to Scenarios, select Factor Normal, set 10x speed",
                "Click Run scenario",
                "Open a second tab as consumer-factor@test.com",
                "Point out contract state, milestones, and alerts updating",
                "Go to Milestones tab, complete the first pending milestone",
                "Show the milestone on the consumer dashboard",
                "Enable Continuous mode to build up data history",
                "When done, Delete the demo contract",
              ].map((step, index) => (
                <div className="flex items-start gap-2.5" key={step}>
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[0.6rem] font-bold tabular-nums text-slate-400">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-[0.72rem] text-slate-300">{step}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Troubleshooting */}
          <Section title="Troubleshooting">
            <div className="space-y-2">
              {[
                { issue: "Admin page does not load", fix: "Confirm the frontend container is running and you are logged in as admin@test.com." },
                { issue: "\"No provider service account configured\"", fix: "The contract pilot type must be FACTOR, TASOWHEEL, or E4M." },
                { issue: "Scenario fails with 401", fix: "The provider token may have expired. Stop and restart the scenario. Confirm Keycloak is running." },
                { issue: "Dashboard does not update", fix: "Refresh the dashboard. Check Runner Output for errors. Open the Events panel to confirm events arrive." },
                { issue: "Contract shows wrong quantity", fix: "Run a new scenario — it will use the contract's actual quantity. Old data from before the fix may show stale values." },
              ].map(({ issue, fix }) => (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2" key={issue}>
                  <p className="text-[0.72rem] font-medium text-rose-300">{issue}</p>
                  <p className="mt-0.5 text-[0.68rem] text-slate-400">{fix}</p>
                </div>
              ))}
            </div>
          </Section>

        </div>
      </ScrollArea>
    </div>
  );
}
