"use client";

import { useEffect, useState } from "react";

type GeographyOption = { id: string; name: string };

export function ReportLocationFilters({ province, city, status }: { province: string; city: string; status: string }) {
  const [provinces, setProvinces] = useState<GeographyOption[]>([]);
  const [localityResult, setLocalityResult] = useState<{ province: string; options: GeographyOption[] } | null>(null);
  const [selectedProvince, setSelectedProvince] = useState(province);
  const [selectedCity, setSelectedCity] = useState(city);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const provinceOption = provinces.find(option => option.name === selectedProvince);
  const localities = localityResult?.province === selectedProvince ? localityResult.options : [];
  const loadingLocalities = Boolean(selectedProvince && (loadingProvinces || (provinceOption && localityResult?.province !== selectedProvince)));

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/geography/provinces", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No pudimos cargar las provincias.");
        const data = await response.json() as { provinces?: GeographyOption[] };
        setProvinces(data.provinces ?? []);
      })
      .catch(() => {})
      .finally(() => { if (!controller.signal.aborted) setLoadingProvinces(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!provinceOption) return;
    const controller = new AbortController();
    fetch(`/api/geography/localities?province=${encodeURIComponent(provinceOption.id)}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("No pudimos cargar las ciudades.");
        const data = await response.json() as { localities?: GeographyOption[] };
        if (!controller.signal.aborted) setLocalityResult({ province: selectedProvince, options: data.localities ?? [] });
      })
      .catch(() => { if (!controller.signal.aborted) setLocalityResult({ province: selectedProvince, options: [] }); });
    return () => controller.abort();
  }, [provinceOption, selectedProvince]);

  return (
    <form action="/reclamos" method="get" className="surface mt-8 grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-6" aria-label="Filtrar por ubicación">
      {status && <input type="hidden" name="status" value={status} />}
      <div>
        <label htmlFor="filter-province" className="form-label">Provincia</label>
        <select id="filter-province" name="province" className="field-control" value={selectedProvince} onChange={event => { setSelectedProvince(event.target.value); setSelectedCity(""); }} disabled={loadingProvinces}>
          <option value="">{loadingProvinces ? "Cargando provincias…" : "Todas las provincias"}</option>
          {provinces.map(option => <option key={option.id} value={option.name}>{option.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="filter-city" className="form-label">Ciudad o localidad</label>
        <select id="filter-city" name="city" className="field-control" value={selectedCity} onChange={event => setSelectedCity(event.target.value)} disabled={!selectedProvince || loadingLocalities}>
          <option value="">{!selectedProvince ? "Elegí una provincia primero" : loadingLocalities ? "Cargando ciudades…" : "Todas las ciudades"}</option>
          {localities.map(option => <option key={option.id} value={option.name}>{option.name}</option>)}
        </select>
      </div>
      <button type="submit" className="civic-button civic-button-primary">Filtrar reclamos</button>
    </form>
  );
}
