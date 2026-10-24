"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReportMap, type MapPoint } from "@/components/report-map";

type CreatedReport = { publicId: string; photoUploadToken?: string };
type GeographyOption = { id: string; name: string };
const MAX_PHOTO_BYTES = 100 * 1024 * 1024;

export function ReportForm() {
  const [location, setLocation] = useState<MapPoint | null>(null);
  const locationValue = useRef<MapPoint | null>(null);
  const points = useMemo(() => location ? [location] : [], [location]);
  const [locationError, setLocationError] = useState("");
  const [address, setAddress] = useState("");
  const [addressHint, setAddressHint] = useState("");
  const addressEditVersion = useRef(0);
  const forwardSearch = useRef<AbortController | null>(null);
  const skipReverseGeocodeFor = useRef<string | null>(null);
  const lastForwardSearch = useRef("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [provinces, setProvinces] = useState<GeographyOption[]>([]);
  const [provinceId, setProvinceId] = useState("");
  const [provinceName, setProvinceName] = useState("");
  const [localities, setLocalities] = useState<GeographyOption[]>([]);
  const [cityId, setCityId] = useState("");
  const [cityName, setCityName] = useState("");
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  const [geographyError, setGeographyError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdReport, setCreatedReport] = useState<CreatedReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/geography/provinces", { signal: controller.signal })
      .then(async response => {
        const result = await response.json() as { provinces?: GeographyOption[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "No pudimos cargar las provincias.");
        setProvinces(result.provinces ?? []);
      })
      .catch(error => { if (!controller.signal.aborted) setGeographyError(error instanceof Error ? error.message : "No pudimos cargar las provincias."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingProvinces(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!provinceId) return;
    const controller = new AbortController();
    fetch(`/api/geography/localities?province=${provinceId}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json() as { localities?: GeographyOption[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "No pudimos cargar las ciudades.");
        setLocalities(result.localities ?? []);
      })
      .catch(error => { if (!controller.signal.aborted) setGeographyError(error instanceof Error ? error.message : "No pudimos cargar las ciudades."); })
      .finally(() => { if (!controller.signal.aborted) setIsLoadingLocalities(false); });
    return () => controller.abort();
  }, [provinceId]);

  function choosePhoto(file: File | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file && /^(image\/(jpeg|png|gif|webp|avif|bmp))$/.test(file.type) ? URL.createObjectURL(file) : null;
    setPhotoPreview(previewUrl.current);
    setPhoto(file);
    setPhotoError("");
  }

  function chooseLocation(point: MapPoint | null, fromAddressSearch = false) {
    forwardSearch.current?.abort();
    forwardSearch.current = null;
    locationValue.current = point;
    skipReverseGeocodeFor.current = fromAddressSearch && point ? `${point.latitude},${point.longitude}` : null;
    setLocation(point);
    setAddressHint(point ? fromAddressSearch ? "Punto aproximado ubicado. Revisá el marcador y la altura en el mapa." : "Punto marcado; buscando la dirección aproximada…" : "");
  }

  function handleAddressChange(value: string) {
    addressEditVersion.current += 1;
    forwardSearch.current?.abort();
    forwardSearch.current = null;
    lastForwardSearch.current = "";
    skipReverseGeocodeFor.current = null;
    locationValue.current = null;
    setLocation(null);
    setAddress(value);
    setAddressHint("");
    setIsSearchingAddress(false);
  }

  async function locateAddress() {
    const query = address.trim();
    if (query.length < 5) return;
    if (location || query === lastForwardSearch.current) return;
    if (!provinceName || !cityName) {
      setAddressHint("Elegí primero una provincia y una ciudad o localidad.");
      return;
    }
    forwardSearch.current?.abort();
    const controller = new AbortController();
    forwardSearch.current = controller;
    const editVersion = addressEditVersion.current;
    setIsSearchingAddress(true);
    setAddressHint("Buscando esa dirección en el mapa…");
    try {
      const params = new URLSearchParams({ street: query, city: cityName, province: provinceName });
      const url = `/api/geocode/search?${params.toString()}`;
      let response = await fetch(url, { signal: controller.signal });
      if (response.status === 429) {
        await new Promise(resolve => window.setTimeout(resolve, 1200));
        if (controller.signal.aborted) return;
        response = await fetch(url, { signal: controller.signal });
      }
      const result = await response.json() as { latitude?: number; longitude?: number; error?: string };
      if (controller.signal.aborted || addressEditVersion.current !== editVersion) return;
      if (!response.ok || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
        setAddressHint(result.error ?? "No encontramos esa dirección. Marcá el punto en el mapa.");
        return;
      }
      const point = { latitude: result.latitude as number, longitude: result.longitude as number, label: query };
      lastForwardSearch.current = query;
      chooseLocation(point, true);
    } catch {
      if (!controller.signal.aborted) setAddressHint("No pudimos buscar esa dirección. Marcá el punto en el mapa.");
    } finally {
      if (forwardSearch.current === controller) {
        forwardSearch.current = null;
        setIsSearchingAddress(false);
      }
    }
  }

  function selectProvince(value: string) {
    const selected = provinces.find(item => item.id === value);
    setProvinceId(value);
    setProvinceName(selected?.name ?? "");
    setLocalities([]);
    setCityId("");
    setCityName("");
    setIsLoadingLocalities(Boolean(value));
    setGeographyError("");
    lastForwardSearch.current = "";
    chooseLocation(null);
  }

  function selectCity(value: string) {
    const selected = localities.find(item => item.id === value);
    setCityId(value);
    setCityName(selected?.name ?? "");
    setGeographyError("");
    lastForwardSearch.current = "";
    chooseLocation(null);
  }

  useEffect(() => {
    if (!location) return;
    const pointKey = `${location.latitude},${location.longitude}`;
    if (skipReverseGeocodeFor.current === pointKey) {
      skipReverseGeocodeFor.current = null;
      return;
    }
    const controller = new AbortController();
    const editVersion = addressEditVersion.current;
    const selected = location;
    const timer = window.setTimeout(async () => {
      try {
        let response = await fetch(`/api/geocode/reverse?lat=${selected.latitude}&lon=${selected.longitude}`, { signal: controller.signal });
        if (response.status === 429) {
          await new Promise(resolve => window.setTimeout(resolve, 1200));
          if (controller.signal.aborted) return;
          response = await fetch(`/api/geocode/reverse?lat=${selected.latitude}&lon=${selected.longitude}`, { signal: controller.signal });
        }
        const result = await response.json() as { address?: string; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok || !result.address) { setAddressHint(result.error ?? "Escribí la dirección manualmente."); return; }
        if (addressEditVersion.current === editVersion) {
          setAddress(result.address);
          setAddressHint("Dirección aproximada de OpenStreetMap. Revisala antes de enviar.");
        }
      } catch {
        if (!controller.signal.aborted) setAddressHint("No pudimos buscar la dirección. Escribila manualmente.");
      }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [location]);

  function locate() {
    setLocationError("");
    if (!navigator.geolocation) { setLocationError("Tu navegador no permite obtener la ubicación."); return; }
    navigator.geolocation.getCurrentPosition(
      position => chooseLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocationError("No pudimos obtener tu ubicación. Podés marcarla en el mapa."),
      { timeout: 10000 },
    );
  }

  async function uploadReportPhoto(report: CreatedReport, file: File) {
    if (!report.photoUploadToken) throw new Error("Falta la autorización de la foto.");
    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "foto";
    const pathname = `reports/${report.publicId}/${crypto.randomUUID()}-${safeName}`;
    const blob = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/reports/photo-upload",
      clientPayload: JSON.stringify({ reportId: report.publicId, token: report.photoUploadToken }),
      contentType: file.type || "application/octet-stream",
    });
    const response = await fetch(`/api/reports/${report.publicId}/photo/attach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: report.photoUploadToken, url: blob.url }),
    });
    if (!response.ok) throw new Error("No pudimos vincular la foto al reporte.");
  }

  async function retryPhoto() {
    if (!createdReport || !photo) return;
    setPhotoError("");
    setIsUploadingPhoto(true);
    try { await uploadReportPhoto(createdReport, photo); setCreatedReport({ publicId: createdReport.publicId }); }
    catch { setPhotoError("El reporte se guardó, pero la foto no. Intentá subirla de nuevo."); }
    finally { setIsUploadingPhoto(false); }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const selectedLocation = locationValue.current;
    const addressParts = String(formData.get("address") ?? "").split(",").map(part => part.trim()).filter(Boolean);
    const normalizedAddressParts = addressParts.map(part => part.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR"));
    for (const locality of [cityName, provinceName]) {
      if (locality && !normalizedAddressParts.includes(locality.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-AR"))) addressParts.push(locality);
    }
    if (photo && photo.size > MAX_PHOTO_BYTES) { setError("La foto no puede superar los 100 MB."); setIsSubmitting(false); return; }
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: selectedLocation?.latitude ?? null,
          longitude: selectedLocation?.longitude ?? null,
          category: formData.get("category"),
          address: addressParts.join(", "),
          description: formData.get("description"),
          expectsPhoto: Boolean(photo),
        }),
      });
      const result = await response.json() as CreatedReport & { error?: string };
      if (!response.ok || !result.publicId) {
        setError(result.error ?? "No pudimos enviar el reporte. Intentá nuevamente.");
        return;
      }
      setCreatedReport(result);
      if (photo) {
        setIsUploadingPhoto(true);
        try { await uploadReportPhoto(result, photo); setCreatedReport({ publicId: result.publicId }); }
        catch { setPhotoError("El reporte se guardó, pero la foto no. Intentá subirla de nuevo."); }
        finally { setIsUploadingPhoto(false); }
      }
    } catch {
      setError("No pudimos enviar el reporte. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdReport) {
    return (
      <div role="status" className="py-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#DCECE5] text-3xl text-[#116D63]" aria-hidden="true">✓</div>
        <h2 className="section-title mt-7">Reporte recibido.</h2>
        {isUploadingPhoto && <p role="status" className="mt-4 text-sm text-[#5B746F]">Subiendo la foto…</p>}
        {photoError && <div role="alert" className="mt-4 rounded-lg bg-[#FFEAE4] p-4 text-sm text-[#9D382B]"><p>{photoError}</p><Button type="button" variant="secondary" onClick={retryPhoto} disabled={isUploadingPhoto} className="mt-3">Reintentar foto</Button></div>}
        <p className="mt-3 max-w-lg leading-7 text-[#5B746F]">Guardá este código. Te sirve para consultar el estado del reclamo desde cualquier dispositivo.</p>
        <div className="mt-7 rounded-xl border border-[#CBDCD4] bg-[#F1F5F2] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <code className="block break-all font-mono text-sm text-[#173735]">{createdReport.publicId}</code>
          <button type="button" className="civic-link mt-3 shrink-0 text-sm sm:mt-0" onClick={async () => { try { await navigator.clipboard.writeText(createdReport.publicId); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar código"}</button>
        </div>
        <Link href={`/reclamo/${createdReport.publicId}`} className="civic-button civic-button-primary mt-7">Ver seguimiento</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submitReport} className="grid gap-9">
      <section>
        <h2 className="text-xl font-bold tracking-[-.035em]">¿Qué pasa?</h2>
        <div className="mt-5"><label htmlFor="category" className="form-label">Tipo de problema</label><select id="category" name="category" className="field-control" defaultValue="" required><option value="" disabled>Elegí una categoría</option><option value="BACHE">Bache o vereda rota</option><option value="INUNDACION">Inundación</option><option value="ALUMBRADO">Alumbrado público</option><option value="BASURA">Basura o limpieza</option><option value="ARBOLADO">Árboles y espacios verdes</option><option value="OTRO">Otro problema</option></select></div>
        <div className="mt-5"><label htmlFor="description" className="form-label">Describí la situación</label><Textarea id="description" name="description" placeholder="Por ejemplo: la luminaria de la esquina no funciona desde el martes" minLength={15} maxLength={2000} rows={5} required className="field-control min-h-36 resize-y" /><p className="form-help">Un detalle concreto ayuda a ubicar y entender el problema.</p></div>
      </section>

      <section className="border-t border-[#CBDCD4] pt-8">
        <h2 className="text-xl font-bold tracking-[-.035em]">¿Dónde ocurre?</h2>
        <div className="mt-5"><label htmlFor="address" className="form-label">Calle y altura</label><Input id="address" name="address" type="text" autoComplete="street-address" placeholder="Ej. Córdoba 1900" minLength={3} maxLength={160} required className="field-control" value={address} onBlur={() => void locateAddress()} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void locateAddress(); } }} onChange={event => handleAddressChange(event.target.value)} /><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><label htmlFor="province" className="form-label">Provincia</label><select id="province" name="province" className="field-control" value={provinceId} onChange={event => selectProvince(event.target.value)} required={!location} disabled={isLoadingProvinces}><option value="">{isLoadingProvinces ? "Cargando provincias…" : "Elegí una provincia"}</option>{provinces.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label htmlFor="city" className="form-label">Ciudad o localidad</label><select id="city" name="city" className="field-control" value={cityId} onChange={event => selectCity(event.target.value)} required={!location} disabled={!provinceId || isLoadingLocalities}><option value="">{!provinceId ? "Primero elegí una provincia" : isLoadingLocalities ? "Cargando ciudades…" : "Elegí una ciudad o localidad"}</option>{localities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div><p className="form-help">Elegí provincia y ciudad para ubicar la dirección. También podés usar tu ubicación actual.</p>{geographyError && <p role="alert" className="form-help text-[#A43E30]">{geographyError}</p>}<div className="mt-2 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={() => void locateAddress()} disabled={isSearchingAddress || address.trim().length < 3 || !cityName || !provinceName} className="h-9 rounded-lg px-3 text-sm">{isSearchingAddress ? "Buscando…" : "Ubicar dirección en el mapa"}</Button>{addressHint && <p role="status" className="form-help !mt-0">{addressHint} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap</a></p>}</div></div>
        <div className="mt-6"><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><p className="form-label !mb-0">Marcá el punto en el mapa</p><span className="text-xs text-[#5B746F]">Opcional</span></div><ReportMap points={points} onSelect={chooseLocation} /><div className="mt-3 flex flex-wrap items-center gap-3"><Button type="button" variant="secondary" onClick={locate} className="h-10 rounded-lg px-4">Usar mi ubicación</Button>{location && <button type="button" className="civic-link text-sm" onClick={() => chooseLocation(null)}>Quitar punto</button>}</div><p className="form-help">{location ? `Punto elegido: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : "Tocá el mapa para señalar el lugar exacto."}</p>{locationError && <p role="alert" className="mt-2 text-sm text-[#A43E30]">{locationError}</p>}</div>
      </section>

      <section className="border-t border-[#CBDCD4] pt-8">
        <h2 className="text-xl font-bold tracking-[-.035em]">¿Tenés una foto?</h2>
        <p className="form-help mt-2">Opcional. Podés adjuntar el archivo original de tu cámara, incluso HEIC, RAW u otros formatos. Hasta 100 MB.</p>
        <label htmlFor="photo" className="civic-button civic-button-outline mt-5 cursor-pointer">{photo ? "Cambiar foto" : "Adjuntar foto"}</label>
        <input id="photo" name="photo" type="file" className="sr-only" onChange={event => choosePhoto(event.target.files?.[0] ?? null)} />
        {photo && <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-[#CBDCD4] bg-[#F1F5F2] p-4">{photoPreview && <Image src={photoPreview} alt="Vista previa de la foto elegida" width={80} height={80} unoptimized className="h-20 w-20 rounded-lg object-cover" />}<div className="min-w-0 flex-1"><p className="break-all text-sm font-semibold">{photo.name}</p><p className="mt-1 text-xs text-[#5B746F]">{(photo.size / 1024 / 1024).toFixed(1)} MB{!photoPreview ? " · Vista previa no disponible; se enviará el original." : ""}</p></div><button type="button" className="civic-link text-sm" onClick={() => choosePhoto(null)}>Quitar</button></div>}
      </section>

      <div className="border-t border-[#CBDCD4] pt-7">
        {error && <p role="alert" className="mb-5 rounded-lg bg-[#FFEAE4] px-4 py-3 text-sm text-[#9D382B]">{error}</p>}
        <Button type="submit" disabled={isSubmitting || isSearchingAddress} className="h-12 w-full rounded-lg px-6 font-bold sm:w-auto">{isSubmitting ? "Enviando reporte…" : isSearchingAddress ? "Buscando dirección…" : "Enviar reporte"}</Button>
        <p className="form-help mt-3">El reporte es público. No hace falta una cuenta.</p>
      </div>
    </form>
  );
}
