import type { World } from "./game";

export function Portrait({
  character = 0,
  tone = "earth",
  appearance = "human",
}: {
  character?: number;
  tone?: World["tone"];
  appearance?: World["characters"][number]["appearance"];
}) {
  const colors = {
    earth: ["#b6ad92", "#d9ccac", "#8e947c"],
    mars: ["#bf8266", "#efd1a1", "#a4624f"],
    night: ["#4e5960", "#bcbca1", "#394950"],
    forest: ["#89997d", "#c5cfac", "#637e62"],
  }[tone];
  const skin = [
    "#c6a07f",
    "#a97956",
    "#d8b18d",
    "#8e644d",
    "#b68968",
    "#dfb9a0",
  ][character];
  const coats = [
    "#414c42",
    "#6a5344",
    "#575c64",
    "#766c4f",
    "#514746",
    "#55604b",
  ];
  const fur = {
    human: skin,
    fox: "#bb7047",
    bird: "#9eaa93",
    deer: "#b18b62",
    bear: "#78614c",
    beaver: "#917354",
    robot: "#a3aaa0",
    alien: "#92a98d",
  }[appearance];
  return (
    <svg
      className="portrait"
      viewBox="0 0 376 184"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="376" height="184" fill={colors[0]} />
      <circle
        cx="294"
        cy="42"
        r={tone === "night" ? 15 : 25}
        fill={colors[1]}
      />
      <path
        d="M0 136 58 112 115 133 205 103 290 126 376 107v77H0"
        fill={colors[2]}
      />
      {tone === "mars" ? (
        <g fill="none" stroke={colors[1]} strokeWidth="1.5">
          <path d="M264 184v-37a44 44 0 0 1 88 0v37M281 184v-37a27 44 0 0 1 54 0v37M264 153h88M28 184v-18a32 32 0 0 1 64 0v18M60 135v49M28 167h64" />
        </g>
      ) : tone === "forest" ? (
        <g fill={colors[2]}>
          <path d="m41 37-23 94h46ZM70 70l-23 83h48ZM323 71l-25 76h49Z" />
          <path d="M38 121h5v63h-5M68 142h5v42h-5M321 140h5v44h-5" />
        </g>
      ) : (
        <g fill={colors[2]}>
          <path d="M15 184V87h47v97M74 184v-73h25v73M269 184V89h40v95M320 184V62h37v122" />
          <path d="m13 87 25-20 26 20m204 2 22-19 22 19" />
        </g>
      )}
      <path
        d="M108 184c5-38 19-57 48-62h62c28 5 44 26 48 62"
        fill={coats[character]}
      />
      <path d="m165 108-5 22 27 27 28-27-6-25" fill={fur} />
      <path
        d="m159 125 28 32-19 27h-35l2-39m80-20-28 32 18 27h36l-9-40"
        fill={coats[character]}
        stroke="#262d2933"
      />
      {appearance === "human" ? (
        <>
          <path
            d="M146 73c0-35 15-52 43-52 31 0 44 18 40 60l-9 28-19 21h-23l-23-25Z"
            fill={skin}
          />
          {character % 3 === 0 ? (
            <path
              d="m143 78-3-23c0-25 21-40 46-40 27 0 49 15 49 42l-8 25-8-33-28 5-32-8-8 34Z"
              fill="#363b33"
            />
          ) : character % 3 === 1 ? (
            <>
              <path
                d="M144 84c-14-46 8-68 43-68 33 0 49 20 47 61l-10 40-5-71c-15 12-40 18-65 12l-1 59Z"
                fill="#484335"
              />
              <path d="m164 114 18 11h13l20-14-14 22h-24Z" fill="#62503e" />
            </>
          ) : (
            <path
              d="M143 68c-6-28 14-49 44-49 31 0 52 23 46 53l-12-29-24 2-39-4-9 28Z"
              fill={character === 2 ? "#c3b9a1" : "#3b3932"}
            />
          )}
          <path
            d="m157 71 16-3m26 0 15 4"
            stroke="#554b3c"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="m184 74-4 18h12m-21 13 14 3 14-5"
            stroke="#785442"
            strokeWidth="1.8"
            fill="none"
          />
          <path d="M161 77h7m34 0h7" stroke="#35392f" strokeWidth="3" />
          {character === 3 && (
            <g stroke="#433e31" strokeWidth="1.8" fill="none">
              <rect x="152" y="72" width="26" height="15" rx="4" />
              <rect x="195" y="72" width="26" height="15" rx="4" />
              <path d="M178 76h17" />
            </g>
          )}
        </>
      ) : appearance === "robot" ? (
        <g>
          <rect
            x="146"
            y="32"
            width="85"
            height="94"
            rx="12"
            fill={fur}
            stroke="#4f5d54"
            strokeWidth="3"
          />
          <path
            d="M145 62h-9v30h9m86-30h9v30h-9M187 31V16"
            fill="none"
            stroke="#4f5d54"
            strokeWidth="4"
          />
          <circle cx="187" cy="13" r="5" fill="#c5b981" />
          <rect x="157" y="62" width="63" height="18" rx="3" fill="#374740" />
          <path d="M166 69h12m22 0h12" stroke="#dfcca0" strokeWidth="3" />
          <path
            d="M166 105h43m-37-6v12m11-12v12m11-12v12m10-12v12"
            stroke="#4f5d54"
            strokeWidth="2"
          />
        </g>
      ) : appearance === "alien" ? (
        <g>
          <path
            d="M141 59c0-49 93-49 93 0 0 36-33 72-47 72s-46-35-46-72"
            fill={fur}
          />
          <path
            d="M154 69q25-1 25 27-23-3-25-27m67 0q-25-1-25 27 23-3 25-27"
            fill="#343f35"
          />
          <path d="M179 113h16" stroke="#5b6f54" strokeWidth="2" />
        </g>
      ) : (
        <g>
          {(appearance === "fox" || appearance === "deer") && (
            <>
              <path d="m151 60-8-46 35 31m25 0 33-31-8 46" fill={fur} />
              <path
                d="m152 43-3-16 13 18m49 0 18-18-5 17"
                stroke="#c6b099"
                strokeWidth="6"
              />
            </>
          )}
          {(appearance === "bear" || appearance === "beaver") && (
            <>
              <circle cx="150" cy="42" r="18" fill={fur} />
              <circle cx="224" cy="42" r="18" fill={fur} />
              <circle cx="150" cy="42" r="10" fill="#b39979" />
              <circle cx="224" cy="42" r="10" fill="#b39979" />
            </>
          )}
          {appearance === "deer" && (
            <path
              d="M161 42 151 15l-12-9m13 10 10-14m50 40 10-27 12-9m-13 10-10-14"
              fill="none"
              stroke="#68533c"
              strokeWidth="4"
            />
          )}
          <path
            d={
              appearance === "fox"
                ? "M144 63q1-38 43-36 43-2 43 36l-8 34-35 36-34-36Z"
                : "M144 66q0-42 43-42t43 42v24q-4 40-43 40t-43-40Z"
            }
            fill={fur}
          />
          {appearance === "bird" ? (
            <>
              <path d="m185 79-23 21 31 12 15-21Z" fill="#ccad66" />
              <path d="m174 29 13-21 9 20 18-14-6 20" fill={fur} />
            </>
          ) : (
            <>
              <ellipse
                cx="187"
                cy="105"
                rx={appearance === "fox" ? 22 : 25}
                ry="20"
                fill="#d1b996"
              />
              <path d="m177 95 10 8 10-8-10-4Z" fill="#393b30" />
              <path
                d="M187 103v10m-10 0q10 7 20 0"
                fill="none"
                stroke="#5a4c39"
                strokeWidth="1.5"
              />
              {appearance === "beaver" && (
                <path d="M180 112h7v12h-7m8-12h7v12h-7" fill="#eee6cc" />
              )}
            </>
          )}
          <path d="M159 72h10m36 0h10" stroke="#343c31" strokeWidth="4" />
        </g>
      )}
      <path
        d="m142 168 18-7m58 7 14 5"
        stroke="#c4c4a7"
        strokeWidth="1.5"
        opacity=".45"
      />
    </svg>
  );
}
