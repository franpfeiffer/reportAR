"use client";

import Form from "next/form";
import Link from "next/link";
import { categoryLabels, statusLabels, urgencyLabels } from "@/lib/labels";

type Option = [value: string, label: string];

const fields: { name: string; label: string; options: Option[] }[] = [
  { name: "status", label: "Estado", options: [["", "Todos"], ...Object.entries(statusLabels)] },
  { name: "urgency", label: "Urgencia", options: [["", "Todas"], ...Object.entries(urgencyLabels)] },
  { name: "category", label: "Categoría", options: [["", "Todas"], ...Object.entries(categoryLabels)] },
  { name: "review", label: "Revisión", options: [["", "Todos"], ["pending", "Urgencia sin revisar"]] },
  { name: "moderation", label: "Moderación", options: [["", "Todos"], ["flagged", "Denunciados"], ["hidden", "Ocultos"]] },
];

// Selects apply on change; the area text field applies on Enter or with the button (which also covers no-JS).
export function ReportFilters({ values }: { values: Record<string, string> }) {
  const active = Object.keys(values).length > 0;
  return (
    <Form
      action="/admin"
      aria-label="Filtros de reclamos"
      onChange={event => { if (event.target instanceof HTMLSelectElement) event.currentTarget.requestSubmit(); }}
      className="surface grid grid-cols-2 items-end gap-3 p-3 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto]"
    >
      {fields.map(field => (
        <div key={field.name}>
          <label htmlFor={`filter-${field.name}`} className="form-label">{field.label}</label>
          <select id={`filter-${field.name}`} name={field.name} defaultValue={values[field.name] ?? ""} className="field-control">
            {field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      ))}
      <div>
        <label htmlFor="filter-area" className="form-label">Área responsable</label>
        <input id="filter-area" name="area" type="search" defaultValue={values.area ?? ""} maxLength={100} placeholder="Todas" className="field-control" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="h-9 rounded-md border border-line bg-paper px-3 text-sm font-semibold hover:bg-mist">Aplicar</button>
        {active && <Link href="/admin" className="civic-link text-sm">Limpiar</Link>}
      </div>
    </Form>
  );
}
