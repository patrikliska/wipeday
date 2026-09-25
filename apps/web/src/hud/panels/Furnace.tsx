import { useWorld } from "../../state/store";
import {
  abbrev,
  duration,
  FURNACE_RATE,
  type ResourceId,
  resourceById,
  tierById,
} from "../../state/world";
import { ResourceIcon } from "../Icon";
import { vars } from "../util";

const ORES: Array<{ input: ResourceId; output: ResourceId }> = [
  { input: "ore", output: "ingots" },
  { input: "sulfur_ore", output: "sulfur" },
];

export function FurnacePanel() {
  const tier = useWorld((state) => state.tier);
  const stock = useWorld((state) => state.stock);
  const jobs = useWorld((state) => state.furnace.jobs);
  const smelt = useWorld((state) => state.smelt);
  const takeOut = useWorld((state) => state.takeOut);
  const clock = useWorld((state) => Math.floor(state.clock / 30) * 30);
  const slots = tierById.get(tier)?.furnaceSlots ?? 1;
  const progressOf = (job: (typeof jobs)[number]): number =>
    Math.min(job.amount, Math.floor((FURNACE_RATE * (clock - job.startedAt)) / 3600));
  const ready = jobs.reduce((sum, job) => sum + progressOf(job) - job.taken, 0);
  const timber = stock.timber ?? 0;

  return (
    <>
      <p className="hint">
        {slots} {slots === 1 ? "slot" : "slots"} · {FURNACE_RATE} per hour each · burns 1 timber per
        2 ore.
      </p>
      {jobs.map((job) => {
        const done = progressOf(job);
        const left = job.amount - done;
        return (
          <div key={`${job.input}-${job.startedAt}`} className="card">
            <ResourceIcon id={job.output} />
            <div className="main">
              <div className="title">
                <b>{resourceById.get(job.output)?.name ?? job.output}</b>
                <span className="lvl num">
                  {abbrev(done)} / {abbrev(job.amount)}
                </span>
              </div>
              <div className="progress" style={vars({ "--bar-color": "#ff8a3c" })}>
                <i style={{ width: `${Math.round((done / job.amount) * 100)}%` }} />
              </div>
              <div className="desc">
                {left <= 0 ? "Finished" : `${duration((left * 3600) / FURNACE_RATE)} left`}
              </div>
            </div>
          </div>
        );
      })}
      {jobs.length === 0 ? (
        <div className="card">
          <div className="main">
            <div className="title">
              <b>The furnace is cold</b>
            </div>
            <div className="desc">
              Load ore below. Ingots are what the next base tier is built from.
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={`btn${ready > 0 ? " primary" : ""}`}
        disabled={ready <= 0}
        onClick={takeOut}
      >
        {ready > 0 ? `Take out · ${abbrev(ready)}` : "Take out · nothing ready"}
      </button>
      {ORES.map(({ input, output }) => {
        const have = Math.floor(stock[input] ?? 0);
        const amount = Math.min(have, 1000);
        const fuel = Math.ceil(amount / 2);
        const slotFree = jobs.length < slots;
        const can = amount > 0 && slotFree && timber >= fuel;
        const inputName = resourceById.get(input)?.name ?? input;
        const outputName = resourceById.get(output)?.name ?? output;
        let label = `Smelt ${abbrev(amount)} ${inputName}`;
        if (!slotFree) label = "Smelt · no free slot";
        else if (amount <= 0) label = `Smelt · need ${inputName.toLowerCase()}`;
        else if (timber < fuel) label = `Smelt · need ${abbrev(fuel - timber)} timber`;
        return (
          <div key={input} className="card">
            <ResourceIcon id={input} />
            <div className="main">
              <div className="title">
                <b>{inputName}</b>
                <span className="lvl num">have {abbrev(have)}</span>
              </div>
              <div className="desc">
                {amount > 0
                  ? `${abbrev(amount)} ${outputName} in ${duration((amount * 3600) / FURNACE_RATE)} · burns ${abbrev(fuel)} timber`
                  : "Gather some first: the rocks by the shore."}
              </div>
              <button type="button" className="btn" disabled={!can} onClick={() => smelt(input)}>
                {label}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
