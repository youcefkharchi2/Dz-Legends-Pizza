"use client";
import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { dateKey, financials, money, type State } from "@/lib/types";
export function ProfitChart({ state }: { state: State }) {
  const [hover, setHover] = useState<number | null>(null);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 6 + i);
        const key = dateKey(date);
        return { date, key, ...financials(state, key, key) };
      }),
    [state],
  );
  const values = days.map((d) => d.profit);
  const max = Math.max(1000, ...values);
  const min = Math.min(0, ...values);
  const top = 18,
    bottom = 157;
  const scale = (v: number) =>
    bottom - ((v - min) / (max - min)) * (bottom - top);
  const zero = scale(0);
  const ticks = Array.from(
    { length: 5 },
    (_, i) => min + ((max - min) * i) / 4,
  );
  const width = 690;
  const left = 73;
  const step = (width - left - 10) / 7;
  const allZero = values.every((v) => v === 0);
  return (
    <div
      className="profit-chart"
      aria-label="Bénéfice net des sept derniers jours"
    >
      {hover !== null && (
        <div
          className="chart-tooltip"
          style={{
            left: `${Math.min(82, Math.max(18, ((left + (hover + 0.5) * step) / width) * 100))}%`,
          }}
        >
          <span>
            {days[hover].date.toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </span>
          <strong>{money(days[hover].profit)}</strong>
          <small>Bénéfice net</small>
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} 212`}
        role="img"
        aria-label={days
          .map(
            (d) => `${d.date.toLocaleDateString("fr-FR")}: ${money(d.profit)}`,
          )
          .join(", ")}
      >
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={left}
              x2={width - 5}
              y1={scale(v)}
              y2={scale(v)}
              stroke="var(--chart-grid)"
              strokeDasharray="3 5"
            />
            <text
              x={left - 12}
              y={scale(v) + 4}
              textAnchor="end"
              className="chart-axis"
            >
              {new Intl.NumberFormat("fr-FR", {
                maximumFractionDigits: 0,
              }).format(v)}
            </text>
          </g>
        ))}
        <text x="8" y="8" className="chart-unit">
          DA
        </text>
        {days.map((day, i) => {
          const x = left + i * step + step * 0.5;
          const y = scale(day.profit);
          return (
            <g
              key={day.key}
              className="chart-day"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`${day.date.toLocaleDateString("fr-FR")}, ${money(day.profit)}`}
            >
              <rect
                x={x - step * 0.44}
                width={step * 0.88}
                y={top - 10}
                height={bottom - top + 15}
                fill={i === 6 ? "var(--chart-today)" : "transparent"}
                rx="8"
              />
              <rect
                data-value={day.profit}
                data-day={day.key}
                x={x - 15}
                width="30"
                y={day.profit >= 0 ? Math.min(y, zero - 3) : zero}
                height={Math.max(3, Math.abs(zero - y))}
                rx="3"
                fill={
                  i === 6
                    ? "var(--gold)"
                    : day.profit < 0
                      ? "var(--red)"
                      : "var(--bar-color)"
                }
              />
              <text
                x={x}
                y="183"
                textAnchor="middle"
                className={`chart-label ${i === 6 ? "chart-label-today" : ""}`}
              >
                {day.date
                  .toLocaleDateString("fr-FR", { weekday: "short" })
                  .replace(".", "")}
              </text>
              <text
                x={x}
                y="201"
                textAnchor="middle"
                className={`chart-date ${i === 6 ? "chart-label-today" : ""}`}
              >
                {day.date.toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </text>
              {i === 6 && (
                <circle cx={x + 21} cy="179" r="2.5" fill="var(--gold)" />
              )}
            </g>
          );
        })}
      </svg>
      {allZero && (
        <div className="chart-empty-label">
          <span>
            <TrendingUp size={17} />
          </span>
          <strong>Chaque grande histoire commence à zéro.</strong>
          <small>
            Vos bénéfices apparaîtront ici après votre première vente.
          </small>
        </div>
      )}
    </div>
  );
}
export function RevenueChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  const width = 800,
    height = 215,
    max = Math.max(1000, ...values),
    min = Math.min(0, ...values);
  const y = (v: number) =>
    height - 35 - ((v - min) / (max - min)) * (height - 60);
  const step = (width - 85) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${65 + i * step},${y(v)}`);
  return (
    <svg
      className="revenue-chart"
      viewBox={`0 0 ${width} ${height}`}
      aria-label="Évolution du chiffre d’affaires"
    >
      {Array.from({ length: 5 }, (_, i) => {
        const v = min + ((max - min) * i) / 4;
        return (
          <g key={i}>
            <line
              x1="65"
              x2="790"
              y1={y(v)}
              y2={y(v)}
              stroke="var(--chart-grid)"
              strokeDasharray="4 6"
            />
            <text x="52" y={y(v) + 4} textAnchor="end" className="chart-axis">
              {Math.round(v).toLocaleString("fr-FR")}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity=".18" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 0 && (
        <>
          <path
            d={`M65,${y(min)} L${points.join(" L")} L${65 + (values.length - 1) * step},${y(min)} Z`}
            fill="url(#revenue-fill)"
          />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2.5"
          />
          {values.map((v, i) => (
            <g key={i}>
              <circle cx={65 + i * step} cy={y(v)} r="4" fill="var(--gold)">
                <title>
                  {labels[i]} : {money(v)}
                </title>
              </circle>
              {(values.length <= 8 ||
                i % Math.ceil(values.length / 8) === 0 ||
                i === values.length - 1) && (
                <text
                  x={65 + i * step}
                  y={height - 8}
                  textAnchor="middle"
                  className="chart-date"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
