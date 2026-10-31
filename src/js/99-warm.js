/* ================= прогрев: все шейдеры собираются до входа, а не во время прогулки =================
   Видеокарта компилирует программу для каждого материала при первой встрече с ним — это и были
   подвисания в начале. Теперь всё, включая скрытые залы, реквизит шоу, тени и постобработку,
   собирается здесь, пока гость смотрит на заставку. */
(async () => {
  const hidden = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try {
    if (renderer.compileAsync && renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
  } catch (e) { console.warn("прогрев:", e && e.message); }
  hidden.forEach(o => { o.visible = false; });
  progress(.95);
  // проходы постобработки и карта теней: один кадр со всеми эффектами под заставкой
  try {
    const wasAp = POST.ap, wasTarget = POST.target;
    if (POST.tier === 2) { POST.target = V3(0, 1.3, -2.4); POST.ap = POST.apWant = .001; }
    if (renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
    POST.render(0);
    POST.ap = wasAp; POST.apWant = 0; POST.target = wasTarget;
    POST.render(0);
  } catch (e) { console.warn("прогрев эффектов:", e && e.message); }
  WARM_DONE = true;
  progress(1);
  if (!closedNow && !started) { enter.disabled = false; if (document.activeElement === document.body) enter.focus({ preventScroll: true }); }
})();
