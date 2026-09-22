import type { Ending, PublicCard, PublicGame, Succession } from "../game";
import { FactionIcon, factionStyle } from "../WorldGraphic";
import { Portrait } from "../Portrait";
import { Words, type CardView } from "./DecisionCard";

export const roman = (n: number) =>
  ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n - 1] ?? String(n);

export function deathsCollected(endings: Ending[]) {
  return new Set(endings.filter((e) => e.faction !== null).map((e) => `${e.faction}:${e.kind}`));
}

export function cardView(game: PublicGame, card: PublicCard): CardView {
  const person = game.world.characters[card.character]!;
  const faction = game.world.factions[person.faction]!;
  const tag = card.commitmentId ? "Promise due" : card.kind === "major" ? "Major crisis" : "";
  return {
    key: card.id,
    kind: card.commitmentId ? "promise" : card.kind,
    label: `${person.name}, ${person.role}: ${card.body}`,
    style: factionStyle(faction),
    options: [card.options[0]!.label, card.options[1]!.label],
    face: (
      <>
        {tag && (
          <p className="card-mark">
            <span className="card-tag">{tag}</span>
          </p>
        )}
        <h2 className="dialogue">
          <Words text={card.body} />
        </h2>
        <footer className="speaker">
          <div className="speaker-portrait">
            <Portrait character={person} />
          </div>
          <div className="speaker-info">
            <strong>{person.name}</strong>
            <span>{person.role}</span>
            <small>
              <FactionIcon faction={faction} />
              {faction.label}
            </small>
          </div>
        </footer>
      </>
    ),
    back: <FactionIcon faction={faction} />,
  };
}

export function successionView(game: PublicGame, card: Succession): CardView {
  const [a, b] = card.candidates.map((i) => game.world.factions[i]!);
  return {
    key: card.id,
    kind: "succession",
    label: "The seat is empty. Choose who backs your successor.",
    style: {},
    options: [`Backed by the ${a!.label}`, `Backed by the ${b!.label}`],
    face: (
      <>
        <p className="card-mark">
          <span>The seat is empty</span>
          <span className="card-tag">Reign {roman(game.reign.number + 1)}</span>
        </p>
        <h2 className="dialogue">
          <Words text="Who backs your successor?" />
        </h2>
        <div className="candidates">
          {[a!, b!].map((f, i) => (
            <div key={f.name} className="candidate" style={factionStyle(f)}>
              <FactionIcon faction={f} />
              <span>
                <strong>{f.label}</strong>
                <small>{i === 0 ? "← swipe left" : "swipe right →"}</small>
              </span>
            </div>
          ))}
        </div>
        <p className="succession-rule">Your backer starts at 65. The rival candidate's faction starts at 40.</p>
      </>
    ),
    back: <span className="seal">R</span>,
  };
}

export function deathView(game: PublicGame, ending: Ending): CardView {
  const earlier = game.endings.slice(0, game.endings.indexOf(ending));
  const fresh = !earlier.some((e) => e.faction === ending.faction && e.kind === ending.kind);
  const collected = deathsCollected(game.endings);
  const best = Math.max(...game.endings.map((e) => e.turns));
  const faction = ending.faction !== null ? game.world.factions[ending.faction] : undefined;
  return {
    key: `death-${game.endings.length}`,
    kind: "death",
    label: `${ending.title}. ${ending.reason}`,
    style: {},
    options: ["Continue", "Continue"],
    face: (
      <>
        <p className="death-kicker">
          Reign {roman(ending.reign)} ends · {game.world.calendar} {ending.year}
        </p>
        <h2 className="death-title">
          <Words text={ending.title} />
        </h2>
        <p className="death-reason">
          <Words text={ending.reason} />
        </p>
        <div className="tally">
          <p>
            Deaths collected {collected.size} of 8 {fresh && <span className="new">New</span>}
          </p>
          <div className="slots" aria-hidden="true">
            {game.world.factions.flatMap((_, f) =>
              (["collapse", "excess"] as const).map((kind) => (
                <i key={`${f}${kind}`} data-on={collected.has(`${f}:${kind}`) || undefined} />
              )),
            )}
          </div>
          <p className="quiet">
            Reigned {ending.turns} {ending.turns === 1 ? "decision" : "decisions"} · Best {best}
          </p>
        </div>
      </>
    ),
    back: faction ? <FactionIcon faction={faction} /> : <span className="seal">R</span>,
  };
}
