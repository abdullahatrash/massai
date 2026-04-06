import { startTransition, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ManualSendForm } from "./ManualSendForm";
import { MilestoneTriggerPanel } from "./MilestoneTriggerPanel";
import { MultiSensorRunner } from "./MultiSensorRunner";
import { ScenarioRunner } from "./ScenarioRunner";
import type { SimulatorContract } from "./simulatorShared";

type SimulationTab = "manual" | "milestones" | "scenarios" | "sensors";

type SimulationWorkspaceProps = {
  contract: SimulatorContract;
  refreshSimulatorData: () => void;
};

export function SimulationWorkspace({ contract, refreshSimulatorData }: SimulationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<SimulationTab>("scenarios");

  return (
    <Tabs
      className="gap-4"
      onValueChange={(value) =>
        startTransition(() => setActiveTab(value as SimulationTab))
      }
      value={activeTab}
    >
      <TabsList
        className="w-fit rounded-xl border border-white/[0.06] bg-white/[0.03] p-1"
        variant="default"
      >
        <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="scenarios">
          Scenarios
        </TabsTrigger>
        <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="manual">
          Manual send
        </TabsTrigger>
        <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="milestones">
          Milestones
        </TabsTrigger>
        <TabsTrigger className="flex-none rounded-lg px-4 text-[0.78rem]" value="sensors">
          Sensors
        </TabsTrigger>
      </TabsList>

      <TabsContent value="scenarios">
        <ScenarioRunner contract={contract} onPlaybackSettled={refreshSimulatorData} />
      </TabsContent>

      <TabsContent value="manual">
        <ManualSendForm contract={contract} onSubmitSettled={refreshSimulatorData} />
      </TabsContent>

      <TabsContent value="milestones">
        <MilestoneTriggerPanel
          contract={contract}
          onSubmissionSettled={refreshSimulatorData}
        />
      </TabsContent>

      <TabsContent value="sensors">
        <MultiSensorRunner contract={contract} />
      </TabsContent>
    </Tabs>
  );
}
