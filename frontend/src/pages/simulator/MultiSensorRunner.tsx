import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { fetchContractIngestSpec } from "../../api/ingestSpec";
import { fetchScenariosForPilot } from "../../api/scenarios";
import {
  getProviderClientConfig,
  type ScenarioDefinition,
} from "../../simulator/runner";
import { SensorPanel } from "./SensorPanel";
import type { SimulatorContract } from "./simulatorShared";

type MultiSensorRunnerProps = {
  contract: SimulatorContract;
};

export function MultiSensorRunner({ contract }: MultiSensorRunnerProps) {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [profileVersion, setProfileVersion] = useState<number | undefined>(
    undefined,
  );
  const [sensorKeys, setSensorKeys] = useState<number[]>([0]);
  const [nextKey, setNextKey] = useState(1);

  const providerClient = getProviderClientConfig(contract.pilotType);

  useEffect(() => {
    const controller = new AbortController();
    setScenariosLoading(true);

    Promise.all([
      fetchScenariosForPilot(contract.pilotType, controller.signal),
      fetchContractIngestSpec(contract.id, controller.signal).catch(
        () => null,
      ),
    ]).then(([loaded, spec]) => {
      setScenarios(loaded);
      if (spec) setProfileVersion(spec.profileVersion);
      setScenariosLoading(false);
    });

    return () => controller.abort();
  }, [contract.id, contract.pilotType]);

  const addSensor = () => {
    setSensorKeys((keys) => [...keys, nextKey]);
    setNextKey((k) => k + 1);
  };

  const removeSensor = (key: number) => {
    setSensorKeys((keys) => keys.filter((k) => k !== key));
  };

  if (!providerClient) {
    return (
      <div className="sim-panel p-4">
        <p className="text-[0.72rem] text-rose-300">
          No provider service account configured for pilot type "
          {contract.pilotType}".
        </p>
      </div>
    );
  }

  if (scenariosLoading) {
    return (
      <div className="sim-panel p-4">
        <p className="text-[0.72rem] text-slate-500">Loading scenarios...</p>
      </div>
    );
  }

  if (scenarios.length === 0) {
    return (
      <div className="sim-panel p-4">
        <p className="text-[0.72rem] text-slate-500">
          No scenarios available for this pilot type.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sim-panel">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h3 className="text-[0.82rem] font-semibold text-white">
            Multi-Sensor Simulation
          </h3>
          <Button onClick={addSensor} size="sm" type="button" variant="ghost">
            <Plus className="size-3" />
            Add sensor
          </Button>
        </div>

        <div className="space-y-3 p-4">
          {sensorKeys.map((key, index) => (
            <SensorPanel
              contractId={contract.id}
              key={key}
              onRemove={() => removeSensor(key)}
              profileVersion={profileVersion}
              providerClient={providerClient}
              quantityOverride={contract.quantityTotal ?? undefined}
              scenarios={scenarios}
              sensorIndex={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
