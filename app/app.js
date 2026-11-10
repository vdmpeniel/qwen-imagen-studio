'use strict';
const $ = s => document.querySelector(s);
const state = { refs: [], gallery: [], selected: null, job: null, ready: false, loading: false, modelsBusy: false, polling: false, deleting: false, checked: new Set(), hardware: null };
const LANG_KEY = 'turbo.lang';
let lang = 'es';
try { if (localStorage.getItem(LANG_KEY) === 'en') lang = 'en'; } catch {}
const TEXT = {
  local: ['◉ Solo en tu equipo', '◉ On your device'],
  models: ['Configuración de modelos', 'Model settings'],
  lang: ['Cambiar idioma', 'Change language'],
  theme: ['Cambiar tema', 'Change theme'],
  studioEyebrow: ['TU ESTUDIO GENERATIVO', 'YOUR GENERATIVE STUDIO'],
  heroTitle: ['Una idea.<br><em>Infinitas imágenes.</em>', 'One idea.<br><em>Endless images.</em>'],
  intro: ['De tu imaginación al lienzo, en local.', 'From your imagination to the canvas, locally.'],
  promptTitle: ['Describe tu imagen', 'Describe your image'],
  inspire: ['Dame una idea ↗', 'Give me an idea ↗'],
  promptPlaceholder: ['Un invernadero de cristal entre nubes, plantas tropicales, luz de la mañana…', 'A glass greenhouse among clouds, tropical plants, morning light…'],
  promptFoot: ['También puedes escribir instrucciones de edición.', 'You can also write editing instructions.'],
  refsTitle: ['Imágenes de referencia', 'Reference images'],
  dropzoneTitle: ['Añade hasta 2 imágenes o arrástralas aquí', 'Add up to 2 images or drag them here'],
  dropzoneHint: ['PNG, JPG o WebP · hasta 8 MB cada una', 'PNG, JPG or WebP · up to 8 MB each'],
  addSecond: ['＋ Añadir segunda referencia', '＋ Add second reference'],
  refHint: ['El orden importa: menciona «imagen 1» o «imagen 2» en tu instrucción. Usa las flechas para reordenar.', 'Order matters: mention “image 1” or “image 2” in your instruction. Use the arrows to reorder.'],
  formatTitle: ['Formato y tamaño', 'Format and size'],
  formatsAria: ['Formatos de imagen', 'Image formats'],
  presetWide: ['16:9 aprox.', '16:9 approx.'],
  presetTall: ['9:16 aprox.', '9:16 approx.'],
  presetTest: ['Prueba', 'Test'],
  width: ['Ancho', 'Width'],
  height: ['Alto', 'Height'],
  swapAria: ['Intercambiar ancho y alto', 'Swap width and height'],
  sizeHint: ['De 256 a 2048 px, en múltiplos de 32. 512 px para probar; 1024 px para crear.', 'From 256 to 2048 px, in multiples of 32. 512 px to test; 1024 px to create.'],
  creativeTitle: ['Control creativo', 'Creative controls'],
  recommended: ['Restaurar Turbo', 'Restore Turbo'],
  steps: ['Pasos', 'Steps'],
  batch: ['Imágenes por lote', 'Images per batch'],
  batch1: ['1 imagen', '1 image'], batch2: ['2 imágenes', '2 images'], batch3: ['3 imágenes', '3 images'], batch4: ['4 imágenes', '4 images'],
  batch5: ['5 imágenes', '5 images'], batch6: ['6 imágenes', '6 images'], batch7: ['7 imágenes', '7 images'], batch8: ['8 imágenes', '8 images'],
  seed: ['Semilla', 'Seed'],
  seedRandom: ['−1 = aleatoria', '−1 = random'],
  randomAria: ['Elegir semilla aleatoria', 'Pick a random seed'],
  transparent: ['Fondo transparente', 'Transparent background'],
  transparentHint: ['Solicitar salida RGBA mediante el prompt', 'Request RGBA output through the prompt'],
  hardwareTitle: ['Equipo de generación', 'Generation hardware'],
  compute: ['Procesamiento', 'Processing'],
  computeAuto: ['Automático', 'Automatic'],
  computeCpu: ['CPU · sin GPU', 'CPU · no GPU'],
  computeGpu: ['GPU', 'GPU'],
  computeHybrid: ['CPU + GPU', 'CPU + GPU'],
  threads: ['Hilos de CPU', 'CPU threads'],
  detecting: ['Detectando los dispositivos compatibles…', 'Detecting compatible devices…'],
  computeHintDefault: ['Automático usa una GPU compatible si está disponible; en otro caso utiliza CPU.', 'Automatic uses a compatible GPU when available; otherwise it uses the CPU.'],
  fast: ['Atención rápida', 'Fast attention'],
  fastHint: ['SageAttention en GPU NVIDIA: ~12 % más rápido, detalles finos ligeramente distintos', 'SageAttention on NVIDIA GPUs: ~12% faster, slightly different fine details'],
  aboutSummary: ['Acerca del motor y los ajustes', 'About the engine and settings'],
  aboutP1: ['Más pasos no garantizan mejor calidad. La edición compleja y la conservación de identidad tienen limitaciones en esta versión. La transparencia depende de la respuesta del modelo.', 'More steps do not guarantee better quality. Complex editing and identity preservation have limitations in this version. Transparency depends on the model response.'],
  aboutP2: ['Los lotes se procesan uno a uno para ahorrar memoria. Cada imagen usa semilla inicial + su posición.', 'Batches are processed one at a time to save memory. Each image uses the starting seed + its position.'],
  generate: ['Crear imagen', 'Create image'],
  privacy: ['Sin créditos. Sin nube. Tu imaginación, en tu equipo.', 'No credits. No cloud. Your imagination, on your device.'],
  canvasEyebrow: ['LIENZO', 'CANVAS'],
  connecting: ['Conectando motor', 'Connecting engine'],
  emptyEyebrow: ['DEJA ESPACIO A LO IMPOSIBLE', 'MAKE ROOM FOR THE IMPOSSIBLE'],
  emptyTitle: ['Todo empieza<br>con una idea.', 'Everything starts<br>with an idea.'],
  emptyText: ['Escribe lo que imaginas. Añade referencias.<br>Hazlo tuyo, hasta el último píxel.', 'Write what you imagine. Add references.<br>Make it yours, down to the last pixel.'],
  tagTextImage: ['Texto → imagen', 'Text → image'],
  tagImageImage: ['Imagen → imagen', 'Image → image'],
  resultAlt: ['Imagen generada', 'Generated image'],
  workingTitle: ['Creando tu imagen', 'Creating your image'],
  workingHint: ['La primera generación tarda más al cargar los modelos.', 'The first generation takes longer while the models load.'],
  cancel: ['Cancelar generación', 'Cancel generation'],
  resultTitle: ['Tu creación', 'Your creation'],
  reuse: ['Reutilizar ajustes', 'Reuse settings'],
  useRef: ['Usar de referencia', 'Use as reference'],
  download: ['Descargar PNG ↗', 'Download PNG ↗'],
  metadataTitle: ['Descargar parámetros JSON', 'Download JSON parameters'],
  deleteImage: ['Eliminar imagen', 'Delete image'],
  libraryEyebrow: ['BIBLIOTECA LOCAL', 'LOCAL LIBRARY'],
  libraryTitle: ['Tus exploraciones', 'Your explorations'],
  deleteAll: ['Eliminar todas', 'Delete all'],
  selectAll: ['Seleccionar todas', 'Select all'],
  deleteSelected: ['Eliminar seleccionadas', 'Delete selected'],
  galleryEmpty: ['Las imágenes que crees aparecerán aquí, incluso después de cerrar la app.', 'Images you create will appear here, even after you close the app.'],
  footerEngine: ['Motor independiente · CPU / GPU · 4 bits', 'Standalone engine · CPU / GPU · 4-bit'],
  modelsEyebrow: ['CONFIGURACIÓN DE MODELOS', 'MODEL SETTINGS'],
  modelsTitle: ['Piezas del motor', 'Engine parts'],
  modelsCloseAria: ['Cerrar la configuración de modelos', 'Close model settings'],
  modelsIntro: ['Elige una versión por pieza. Las variantes descargadas muestran Activar y Borrar; al activar, el motor se recarga solo. Si falta algún archivo de la configuración, se descarga y se aplica automáticamente.', 'Choose one version per part. Downloaded variants show Activate and Delete; activating reloads the engine automatically. If any file in the configuration is missing, it is downloaded and applied automatically.'],
  modelsLoading: ['Cargando el catálogo de modelos…', 'Loading the model catalog…'],
  modelsClose: ['Cerrar', 'Close'],
  stepsHintOk: ['6 pasos · configuración recomendada para Viggle v0.2.1.', '6 steps · recommended setting for Viggle v0.2.1.'],
  stepsHintCustom: ['Modo experimental: usa 6 pasos para v0.2.1. Se conservan los nodos de entrenamiento al añadir pasos; menos de 4 no está recomendado.', 'Experimental mode: use 6 steps for v0.2.1. Training nodes are preserved when adding steps; fewer than 4 is not recommended.'],
  generateWaitDownloads: ['Espera a que terminen las descargas y la recarga de modelos.', 'Wait for downloads and model reloading to finish.'],
  generateWaitLoading: ['Espera a que el motor termine de cargar los modelos.', 'Wait for the engine to finish loading the models.'],
  computeAutoHint: ['Automático usa GPU con una tarjeta dedicada, CPU + GPU con una GPU integrada y CPU si no hay GPU compatible.', 'Automatic uses the GPU with a dedicated card, CPU + GPU with an integrated GPU, and CPU when no compatible GPU is available.'],
  computeCpuHint: ['Todo el cálculo se realiza en CPU. Puede tardar varios minutos o más. Empieza con 512 × 512 y 6 pasos. 0 hilos = automático.', 'All computation runs on the CPU. It may take several minutes or more. Start with 512 × 512 and 6 steps. 0 threads = automatic.'],
  computeGpuHint: ['Todo el cálculo se realiza en la GPU. Los pesos esperan en RAM y cada modelo pasa a la VRAM cuando se necesita.', 'All computation runs on the GPU. Weights wait in RAM and each model moves to VRAM when needed.'],
  computeHybridHint: ['La CPU interpreta el texto y las referencias; la GPU genera y decodifica la imagen. Para GPU integrada o con poca VRAM; con una GPU dedicada de 8 GB, GPU es algo más rápido.', 'The CPU interprets text and references; the GPU generates and decodes the image. For integrated GPUs or little VRAM; with a dedicated 8 GB GPU, GPU is slightly faster.'],
  computeSuffix: [' Al cambiar el modo, los modelos se cargan de nuevo en segundo plano.', ' Changing the mode reloads the models in the background.'],
  refItem: ['Imagen {n}', 'Image {n}'],
  refAlt: ['Referencia {n}', 'Reference {n}'],
  refMoveLeft: ['Mover referencia a la izquierda', 'Move reference left'],
  refRemove: ['Quitar referencia {n}', 'Remove reference {n}'],
  errMaxRefs: ['El modelo admite un máximo de 2 referencias.', 'The model supports at most 2 references.'],
  errFileType: ['Usa PNG, JPG o WebP de hasta 8 MB.', 'Use PNG, JPG or WebP up to 8 MB.'],
  errTooLarge: ['La referencia excede 40 megapíxeles. Redúcela antes de subirla.', 'The reference exceeds 40 megapixels. Resize it before uploading.'],
  resultSteps: ['{n} pasos', '{n} steps'],
  seedShort: ['Semilla', 'Seed'],
  refsCount: ['{n} referencias', '{n} references'],
  mergedLora: ['LoRA fusionado', 'Merged LoRA'],
  externalEngine: ['Motor externo', 'External engine'],
  gallerySteps: ['{n} pasos · {seed}', '{n} steps · {seed}'],
  galleryDelete: ['Eliminar', 'Delete'],
  galleryDeleteAria: ['Eliminar imagen con semilla {seed}', 'Delete image with seed {seed}'],
  gallerySelect: ['Seleccionar', 'Select'],
  gallerySelectAria: ['Seleccionar imagen con semilla {seed}', 'Select image with seed {seed}'],
  reuseNotice: ['Ajustes, semilla y referencias restaurados. Puedes repetir o modificar la creación.', 'Settings, seed and references restored. You can repeat or modify the creation.'],
  useRefNotice: ['Imagen añadida a las referencias. Describe el cambio que quieres hacer.', 'Image added to references. Describe the change you want to make.'],
  errRemoveFirst: ['Quita una referencia antes de añadir otra.', 'Remove a reference before adding another.'],
  confirmDeleteSelected: ['¿Eliminar las {n} imágenes seleccionadas?', 'Delete the {n} selected images?'],
  confirmDeleteItem: ['¿Eliminar esta imagen de la biblioteca?', 'Delete this image from the library?'],
  confirmDeleteAll: ['¿Eliminar las {n} imágenes de la biblioteca?', 'Delete all {n} images from the library?'],
  deletedSelected: ['Imágenes seleccionadas eliminadas.', 'Selected images deleted.'],
  deletedItem: ['Imagen eliminada de la biblioteca.', 'Image deleted from the library.'],
  deletedAll: ['Biblioteca vaciada.', 'Library cleared.'],
  selectedCount: ['{n} seleccionadas', '{n} selected'],
  jobTitle: ['Creando {current} de {total}', 'Creating {current} of {total}'],
  jobCancelWait: ['Esperando a que termine la imagen…', 'Waiting for the image to finish…'],
  jobCancel: ['Detener tras esta imagen', 'Stop after this image'],
  jobPollError: ['No se pudo consultar la generación: {error}. Reconectando al motor…', 'Could not check the generation: {error}. Reconnecting to the engine…'],
  hwThreads: ['{n} hilos', '{n} threads'],
  hwNoGpu: ['Sin GPU compatible detectada. Puedes generar con CPU.', 'No compatible GPU detected. You can generate on the CPU.'],
  hwGpuIntegrated: ['(integrada)', '(integrated)'],
  engineMerged: ['LoRA fusionado en los pesos (más rápido y con menos VRAM).', 'LoRA merged into the weights (faster and uses less VRAM).'],
  engineRuntime: ['LoRA aplicado en tiempo de ejecución.', 'LoRA applied at runtime.'],
  engineTail: ['Euler con el planificador Turbo, CFG 1 y sin prompt negativo, como requiere este modelo.', 'Euler with the Turbo scheduler, CFG 1 and no negative prompt, as this model requires.'],
  statusDownloading: ['Descargando modelos…', 'Downloading models…'],
  statusLoadingModels: ['Cargando modelos…', 'Loading models…'],
  statusEngineReady: ['Motor listo · {mode}', 'Engine ready · {mode}'],
  statusReady: ['Listo para generar', 'Ready to generate'],
  statusDetecting: ['Detectando / desconectado', 'Detecting / disconnected'],
  statusDisconnected: ['Servidor desconectado', 'Server disconnected'],
  numberOptions: ['Opciones de {label}', '{label} options'],
  numberValues: ['Valores de {label}', '{label} values'],
  numAuto: ['Automático (0)', 'Automatic (0)'],
  numThreads: ['{n} hilos', '{n} threads'],
  numRandom: ['Aleatoria (−1)', 'Random (−1)'],
  numSeed: ['Semilla {n}', 'Seed {n}'],
  numSteps: ['{n} pasos', '{n} steps'],
  numStepsTurbo: ['6 · Turbo v0.2.1', '6 · Turbo v0.2.1'],
  errorHttp: ['Error {status}', 'Error {status}'],
  downloadQueued: ['En cola', 'Queued'],
  downloadDownloading: ['Descargando', 'Downloading'],
  downloadVerifying: ['Verificando', 'Verifying'],
  downloadConverting: ['Convirtiendo LoRA', 'Converting LoRA'],
  downloadDone: ['Instalado', 'Installed'],
  downloadCancelled: ['Cancelada', 'Cancelled'],
  downloadError: ['Error', 'Error'],
  modelDownloadingOf: ['{a} de {b}', '{a} of {b}'],
  modelBadgeActive: ['Activa', 'Active'],
  modelBadgePending: ['Pendiente', 'Pending'],
  modelBadgeInstalled: ['Instalada', 'Installed'],
  modelBadgeLocal: ['Local', 'Local'],
  modelBadgeUnavailable: ['No descargable', 'Not downloadable'],
  modelConfirmLocal: ['¿Borrar el fusionado y su prueba?', 'Delete the merged model and its test?'],
  modelConfirmDisk: ['¿Borrar del disco?', 'Delete from disk?'],
  modelYesDelete: ['Sí, borrar', 'Yes, delete'],
  modelNo: ['No', 'No'],
  modelCancelDownload: ['Cancelar descarga', 'Cancel download'],
  modelVerifying: ['Verificando…', 'Verifying…'],
  modelDownload: ['Descargar', 'Download'],
  modelActivate: ['Activar', 'Activate'],
  modelDelete: ['Borrar', 'Delete'],
  modelLoraBlockedTitle: ['El modelo de difusión activo ya lleva el LoRA fusionado.', 'The active diffusion model already includes the merged LoRA.'],
  modelBusyTitle: ['Espera a que terminen la operación en curso.', 'Wait for the current operation to finish.'],
  modelLoraNote: ['El modelo de difusión activo ya lleva el LoRA fusionado, así que esta pieza no se aplica.', 'The active diffusion model already includes the merged LoRA, so this part does not apply.'],
  modelVerified: ['Modelos verificados. La nueva configuración está activa y el motor se ha recargado.', 'Models verified. The new configuration is active and the engine has reloaded.'],
  modelFooterPending: ['Configuración pendiente', 'Pending configuration'],
  modelFooterActive: ['Configuración activa', 'Active configuration'],
  modelFooterMissing: ['{n} archivo(s) por descargar ({size})', '{n} file(s) to download ({size})'],
  modelFooterAll: ['todo instalado', 'all installed'],
  modelFooterDisk: [' · {size} libres en disco', ' · {size} free on disk'],
  modelDiskRam: ['{ram} GB de RAM', '{ram} GB of RAM'],
  modelDownloadStart: ['Descargando {name}. Puedes seguir usando la app; continuará en segundo plano.', 'Downloading {name}. You can keep using the app; it will continue in the background.'],
  modelCancelMsg: ['Descarga de {name} cancelada. El archivo parcial se conserva para reanudarla.', 'Download of {name} cancelled. The partial file is kept so it can resume.'],
  modelDeleted: ['{name} se borró del disco.', '{name} was deleted from disk.'],
  modelPendingCleared: [' La activación pendiente se canceló.', ' The pending activation was cancelled.'],
  modelActivating: ['Activando {name}…', 'Activating {name}…'],
  modelMissingFiles: ['Faltan {n} archivo(s). {name} se activará automáticamente cuando terminen las descargas.', '{n} file(s) missing. {name} will activate automatically when the downloads finish.'],
  modelActivatedRestart: ['{name} activado. El motor se está recargando.', '{name} activated. The engine is reloading.'],
  modelActivated: ['{name} activado.', '{name} activated.']
};
const SERVER_EN = {
  'Qwen Image 2.1 · configuración incompleta': 'Qwen Image 2.1 · incomplete configuration',
  'Espera a que termine la generación en curso.': 'Wait for the current generation to finish.',
  'Espera a que termine la generación u otra eliminación.': 'Wait for the current generation or deletion to finish.',
  'Espera a que termine la operación en curso.': 'Wait for the current operation to finish.',
  'Es el modelo activo. Activa otra variante y aplica antes de borrarlo.': 'It is the active model. Activate another variant and apply it before deleting.',
  'Es la última opción instalada de esta pieza.': 'It is the last installed option for this part.',
  'Este modelo se genera localmente y no se descarga.': 'This model is generated locally and cannot be downloaded.',
  'Ese modelo está activo. Activa otro de la misma pieza antes de borrarlo.': 'That model is active. Activate another variant of the same part before deleting it.',
  'No puedes borrar la última opción instalada de esta pieza.': 'You cannot delete the last installed option for this part.',
  'Este servidor usa un motor externo. Usa "./iniciar.sh" para seleccionar CPU/GPU.': 'This server uses an external engine. Use "./iniciar.sh" to select CPU/GPU.',
  'Host no permitido.': 'Host not allowed.',
  'No encontrado.': 'Not found.',
  'Trabajo no encontrado.': 'Job not found.',
  'Modelo desconocido.': 'Unknown model.',
  'Selecciona al menos una imagen válida.': 'Select at least one valid image.',
  'La biblioteca cambió. Actualiza la selección.': 'The library changed. Refresh the selection.',
  'Solicitud inválida.': 'Invalid request.',
  'Escribe una descripción de entre 1 y 6000 caracteres.': 'Write a description between 1 and 6000 characters.',
  'El ancho y alto deben ser múltiplos de 32.': 'Width and height must be multiples of 32.',
  'La semilla del lote excede el máximo permitido.': 'The batch seed exceeds the maximum allowed.',
  'Selecciona Automático, CPU, GPU o CPU + GPU.': 'Select Automatic, CPU, GPU or CPU + GPU.',
  'Puedes usar hasta 2 referencias.': 'You can use up to 2 references.',
  'Referencia inválida. Usa PNG, JPEG o WebP de hasta 8 MB.': 'Invalid reference. Use PNG, JPEG or WebP up to 8 MB.',
  'El contenido de la referencia no es una imagen compatible.': 'The reference content is not a supported image.',
  'fastAttention debe ser verdadero o falso.': 'fastAttention must be true or false.',
  'Imágenes guardadas en tu biblioteca local.': 'Images saved to your local library.',
  'Generación cancelada. Las imágenes terminadas se conservaron.': 'Generation cancelled. Finished images were kept.',
  'Se detendrá al finalizar la imagen en curso. No se iniciarán más imágenes del lote.': 'It will stop after the current image. No more images from the batch will start.',
  'El motor no pudo generar la imagen.': 'The engine could not generate the image.',
  'El motor no devolvió una imagen.': 'The engine did not return an image.',
  'La respuesta del motor no es un PNG válido.': 'The engine response is not a valid PNG.',
  'El motor no pudo completar la imagen.': 'The engine could not complete the image.',
  'No quedó suficiente memoria RAM o swap para completar la imagen. Cierra otras aplicaciones pesadas y vuelve a intentarlo; si persiste, reduce el tamaño.': 'There was not enough RAM or swap to complete the image. Close other heavy applications and try again; if it persists, reduce the size.',
  'La GPU no tuvo memoria suficiente para completar la imagen. Prueba un tamaño menor, el modo CPU + GPU (texto en CPU) o CPU.': 'The GPU did not have enough memory to complete the image. Try a smaller size, CPU + GPU mode (text on CPU) or CPU.'
};
const SERVER_EN_RULES = [
  [/^Selección inválida para «(.+)»\.$/, 'Invalid selection for «$1».'],
  [/^(width|height|steps|count|seed|threads): debe estar entre (-?\d+) y (-?\d+)\.$/, '$1: must be between $2 and $3.'],
  [/^Faltan modelos de la configuración activa: (.+) Abre «Configuración de modelos» para descargarlos\.$/, 'Missing models for the active configuration: $1 Open “Model settings” to download them.'],
  [/^Creando imagen (\d+) de (\d+)\.$/, 'Creating image $1 of $2.'],
  [/^Preparando el motor para (\w+)\./, 'Preparing the engine for $1.'],
  [/ Cambiar de dispositivo requiere recargar los modelos\./g, ' Changing devices requires reloading the models.'],
  [/ Se cerró el motor para liberar su memoria; se cargará de nuevo al reintentar\./g, ' The engine was closed to free its memory; it will load again on the next attempt.'],
  [/ Se conservaron las (\d+) imágenes terminadas\./g, ' The $1 finished images were kept.'],
  [/ Consulta logs\/engine\.err\.log para ver la causa\./g, ' Check logs/engine.err.log for the cause.']
];
const SERVER_EN_ENTRIES = Object.entries(SERVER_EN).sort((a, b) => b[0].length - a[0].length);
const ROLE_LABEL_EN = {
  'Modelo de imagen (difusión)': 'Image model (diffusion)',
  'Codificador de texto': 'Text encoder',
  'Proyector de visión (mmproj)': 'Vision projector (mmproj)',
  'LoRA Turbo': 'Turbo LoRA'
};
const MODEL_EN = {
  roles: {
    diffusion: { label: 'Image model (diffusion)', hint: '“Merged” models already include the Turbo LoRA. “Base” models apply it at runtime.' },
    textEncoder: { label: 'Text encoder', hint: 'Smaller quantizations reduce memory at the cost of prompt accuracy.' },
    mmproj: { label: 'Vision projector (mmproj)', hint: 'Required to use reference images.' },
    lora: { label: 'Turbo LoRA', hint: 'Only applies to “base” diffusion models. It is ignored with a merged one.' },
    vae: { label: 'VAE', hint: 'Decodes the latent into an image. There is only one official version.' }
  },
  items: {
    'diff-merged-local': { label: 'Viggle Turbo v0.2.1 · Q4_K merged', detail: 'Generated locally during install. No runtime LoRA.' },
    'diff-merged-v021-q4km': { detail: 'Official Viggle model with the Turbo LoRA already merged.' },
    'diff-merged-v021-q5km': { detail: 'Higher quality than Q4_K_M but uses more memory.' },
    'diff-merged-v021-q6k': { detail: 'High quality; intended for machines with 16 GB or more.' },
    'diff-merged-v021-q8': { detail: 'Almost lossless; requires a lot of memory.' },
    'diff-base-q2k': { detail: 'The smallest. Reduced quality; requires the runtime LoRA.' },
    'diff-base-q3k': { detail: 'A balance between size and quality; requires the runtime LoRA.' },
    'diff-base-q4-0': { detail: 'Classic 4-bit quantization; requires the runtime LoRA.' },
    'diff-base-q4k': { detail: 'Base of the current merged model; requires the runtime LoRA.' },
    'diff-base-q5-0': { detail: '5-bit; requires the runtime LoRA.' },
    'diff-base-q6k': { detail: 'High quality; requires the runtime LoRA.' },
    'diff-base-q8': { detail: 'Almost lossless; requires the runtime LoRA and a lot of memory.' },
    'text-qwen3vl-q4km': { detail: 'The version used by the installer. A good balance.' },
    'text-qwen3vl-q8': { detail: 'Better prompt accuracy; takes 3.7 GB more.' },
    'text-qwen3vl-f16': { detail: 'Full precision; 16.4 GB, only for machines with plenty of RAM.' },
    'text-unsloth-ud-iq2-xxs': { detail: 'The smallest. Intended for 10 GB machines; prompt quality is lower.' },
    'text-unsloth-ud-iq2-m': { detail: 'One step up in quality from IQ2_XXS with 0.5 GB extra.' },
    'text-unsloth-q2k': { detail: '2-bit K quantization; a better text trade-off than IQ2.' },
    'text-unsloth-ud-q2k-xl': { detail: 'Dynamic 2-bit mix; slightly better than Q2_K with 0.2 GB extra.' },
    'text-unsloth-q3ks': { detail: 'Small 3-bit; a good balance for 16 GB.' },
    'text-unsloth-q3km': { detail: 'Medium 3-bit; quality close to Q4 with 0.9 GB less.' },
    'mmproj-f16': { detail: 'Full-precision vision projector. The one used by the installer.' },
    'mmproj-q8': { detail: 'Saves 0.4 GB with minimal loss in references.' },
    'lora-r256': { detail: 'The installer LoRA. It is converted to the engine format when downloaded.' },
    'lora-r128': { detail: 'Half the size of r256 with very similar quality.' },
    'vae-bf16': { detail: 'The only official VAE version.' }
  }
};
const IDEAS = {
  es: ['Un jardín botánico dentro de una estación espacial, helechos gigantes, ventanas hacia Saturno, fotografía cinematográfica, luz dorada.', 'Un cartel tipográfico que dice "IMAGINA", formas de papel tridimensionales en tonos lavanda y coral, composición editorial limpia.'],
  en: ['An elegant ceramic teapot shaped like a tiny house, lavender glaze, soft morning sunlight, minimalist product photography, warm cream background.', 'An editorial photograph of a red fox in a snowy forest at sunrise, soft mist, detailed fur, warm backlight, natural colors.']
};
function t(key, vars) {
  const entry = TEXT[key];
  const value = entry ? entry[lang === 'en' ? 1 : 0] : key;
  return vars ? value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '') : value;
}
function serverText(value) {
  if (lang !== 'en' || value == null) return value;
  let text = String(value);
  for (const [pattern, replacement] of SERVER_EN_RULES) text = text.replace(pattern, replacement);
  for (const [source, target] of SERVER_EN_ENTRIES) if (text.includes(source)) text = text.split(source).join(target);
  for (const [source, target] of Object.entries(ROLE_LABEL_EN)) if (text.includes(source)) text = text.split(source).join(target);
  return text;
}
function localRole(role, field) { return lang === 'en' ? (MODEL_EN.roles[role.id]?.[field] ?? role[field]) : role[field]; }
function localItem(item, field) { return lang === 'en' ? (MODEL_EN.items[item.id]?.[field] ?? item[field]) : item[field]; }
function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => { el.alt = t(el.dataset.i18nAlt); });
  const menu = $('#langMenu');
  if (menu) menu.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lang === lang)));
  buildNumberCombos();
  refreshForm();
  renderRefs();
  renderGallery();
  syncSelection();
  if (state.selected) selectImage(state.selected);
  if (models.open) { renderModels(); renderModelsFooter(); }
  void status();
}
async function api(path, options = {}) {
  const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await r.json(); if (!r.ok) throw new Error(serverText(data.error || t('errorHttp', { status: r.status }))); return data;
}
function notice(message, error = false) { message = serverText(message); $('#notice').hidden = false; $('#notice').textContent = message; $('#notice').classList.toggle('error', error); }
function settings() { return { prompt: $('#prompt').value, width: +$('#width').value, height: +$('#height').value, steps: +$('#steps').value, count: +$('#count').value, seed: +$('#seed').value, compute: $('#compute').value, threads: +$('#threads').value, transparent: $('#transparent').checked, fastAttention: $('#fastAttention').checked }; }
// Loads the models for the selected device while the prompt is written, so the first image starts at once.
let warmTimer = null, warmedKey = null, pendingKey = null;
function warmEngine() {
  const s = settings(), key = JSON.stringify([s.compute, s.threads, s.fastAttention]);
  if (state.job || !state.hardware || key === warmedKey || key === pendingKey || !Number.isInteger(s.threads) || s.threads < 0 || s.threads > 128) return;
  clearTimeout(warmTimer); pendingKey = key;
  warmTimer = setTimeout(() => {
    pendingKey = null;
    if (state.job || JSON.stringify([$('#compute').value, +$('#threads').value, $('#fastAttention').checked]) !== key) return;
    warmedKey = key;
    api('/api/engine/warmup', { method: 'POST', body: JSON.stringify({ compute: s.compute, threads: s.threads, fastAttention: s.fastAttention }) }).catch(() => { warmedKey = null; });
  }, 700);
}
function persist() { try { localStorage.setItem('turbo.settings', JSON.stringify(settings())); } catch {} }
function refreshForm() {
  const s = settings(); $('#chars').textContent = `${s.prompt.length}/6000`;
  $('#canvasSize').textContent = `${s.width} × ${s.height}`; $('#megapixels').textContent = `${(s.width*s.height/1e6).toFixed(2)} MP`;
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', +b.dataset.w === s.width && +b.dataset.h === s.height));
  $('#stepsHint').textContent = t(s.steps === 6 ? 'stepsHintOk' : 'stepsHintCustom');
  $('#generate').disabled = !!state.job || !state.ready || state.modelsBusy || state.loading;
  $('#generate').title = state.modelsBusy ? t('generateWaitDownloads') : state.loading ? t('generateWaitLoading') : '';
  syncStatusActivity();
  $('#compute').disabled=!!state.job;$('#fastAttention').disabled=!!state.job;
  const computeHint = { auto: t('computeAutoHint'), cpu: t('computeCpuHint'), gpu: t('computeGpuHint'), hybrid: t('computeHybridHint') }[$('#compute').value] || '';
  $('#computeHint').textContent = computeHint + t('computeSuffix');
  syncSelection();
  document.querySelectorAll('.gallery-delete, #deleteAll, #delete').forEach(b=>b.disabled=!!state.job||state.deleting||!state.gallery.length);
  persist(); warmEngine();
}
function syncStatusActivity(){const activity=state.modelsBusy||state.loading;$('#statusDot').hidden=activity;$('#statusSpinner').hidden=!activity;}
function setSettings(s) { for (const key of ['prompt','width','height','steps','count','seed','compute','threads']) if (s[key] !== undefined) $(`#${key}`).value = s[key]; $('#transparent').checked = s.transparent === true; if (typeof s.fastAttention === 'boolean') $('#fastAttention').checked = s.fastAttention; refreshForm(); }
function renderRefs() {
  $('#refs').replaceChildren(); $('#refCount').textContent = `${state.refs.length} / 2`; $('#refHint').hidden = !state.refs.length; $('#addSecond').hidden = state.refs.length !== 1;
  state.refs.forEach((src,i) => {
    const div = document.createElement('div'); div.className = 'ref';
    const img = document.createElement('img'); img.src = src; img.alt = t('refAlt', { n: i+1 });
    const nav = document.createElement('nav'); const label = document.createElement('span'); label.textContent = t('refItem', { n: i+1 }); nav.append(label);
    if (i) { const prev = document.createElement('button'); prev.type='button'; prev.textContent='←'; prev.title=t('refMoveLeft'); prev.onclick=()=>{[state.refs[i-1],state.refs[i]]=[state.refs[i],state.refs[i-1]];renderRefs();}; nav.append(prev); }
    const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.setAttribute('aria-label',t('refRemove', { n: i+1 })); remove.onclick=()=>{state.refs.splice(i,1);renderRefs();}; nav.append(remove);
    div.append(img,nav); $('#refs').append(div);
  });
}
async function addFiles(files) {
  try {
    for (const file of files) {
      if (state.refs.length >= 2) throw new Error(t('errMaxRefs'));
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8*1024*1024) throw new Error(t('errFileType'));
      // Decode and normalize uploads; limits decoded dimensions before inference.
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) { bitmap.close(); throw new Error(t('errTooLarge')); }
      const scale = Math.min(1, 1536 / Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width*scale); canvas.height = Math.round(bitmap.height*scale);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      state.refs.push(canvas.toDataURL('image/png')); renderRefs();
    }
  } catch(e) { notice(e.message,true); }
  $('#files').value='';
}
$('#addSecond').onclick=()=>$('#files').click();
$('#files').onchange = e => addFiles(e.target.files);
const dz=$('#dropzone'); for(const event of ['dragenter','dragover']) dz.addEventListener(event,e=>{e.preventDefault();dz.classList.add('drag');});
for(const event of ['dragleave','drop']) dz.addEventListener(event,e=>{e.preventDefault();dz.classList.remove('drag');});
dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>{ $('#width').value=b.dataset.w;$('#height').value=b.dataset.h;refreshForm(); });
$('#swap').onclick=()=>{const w=$('#width').value;$('#width').value=$('#height').value;$('#height').value=w;refreshForm();};
$('#form').addEventListener('input',e=>{if(!e.target.matches('[data-number]'))refreshForm();});
$('#random').onclick=()=>{$('#seed').value=crypto.getRandomValues(new Uint32Array(1))[0]%2147483640;refreshForm();};
$('#recommended').onclick=()=>{$('#steps').value=6;refreshForm();};
let ideaIndex=0;$('#inspire').onclick=()=>{const list=IDEAS[lang]||IDEAS.es;$('#prompt').value=list[ideaIndex++%list.length];refreshForm();};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');try{localStorage.setItem('turbo.theme',document.body.classList.contains('dark')?'dark':'light');}catch{}};
function setLanguage(next){if(next!=='en'&&next!=='es')return;lang=next;try{localStorage.setItem(LANG_KEY,lang);}catch{}applyLanguage();}
function closeLangMenu(){const menu=$('#langMenu');if(!menu)return;menu.hidden=true;$('#lang').setAttribute('aria-expanded','false');}
$('#lang').onclick=e=>{e.stopPropagation();const menu=$('#langMenu');const open=menu.hidden;menu.hidden=!open;$('#lang').setAttribute('aria-expanded',String(open));};
$('#langMenu').querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>{setLanguage(b.dataset.lang);closeLangMenu();$('#lang').focus();});
document.addEventListener('click',e=>{if(!e.target.closest('.lang-wrap'))closeLangMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeLangMenu();});
function selectImage(item) {
  state.selected=item; $('#result').src=item.src;$('#result').hidden=false;$('#empty').hidden=true;$('#resultInfo').hidden=false;
  $('#resultTitle').textContent=item.prompt.length>85?item.prompt.slice(0,85)+'…':item.prompt;
  const meta = [`${item.width} × ${item.height}`, t('resultSteps', { n: item.steps }), `${t('seedShort')} ${item.seed}`, t('refsCount', { n: item.refsCount||0 }), 'v'+(item.modelVersion||'0.1')];
  if(item.computeUsed) meta.push(item.computeUsed==='external' ? t('externalEngine') : ({cpu:'CPU',gpu:'GPU',hybrid:'CPU + GPU'}[item.computeUsed]||item.computeUsed));
  if(item.loraApplication==='merged') meta.push(t('mergedLora'));
  if(item.seconds) meta.push(item.seconds+' s');
  $('#resultMeta').textContent=meta.join(' · ');
  $('#download').href=item.src;$('#download').download=`qwen-imagen-${item.seed}.png`;
  $('#metadata').href=`/outputs/${item.id}.json`;$('#metadata').download=`qwen-imagen-${item.seed}.json`;
  document.querySelectorAll('.thumb').forEach(b=>b.classList.toggle('selected',b.dataset.id===item.id));
}
function renderGallery() {
  $('#gallery').replaceChildren();$('#galleryCount').textContent=state.gallery.length;$('#galleryEmpty').hidden=!!state.gallery.length;
  state.gallery.forEach(item=>{
    const card=document.createElement('article');card.className='gallery-card';
    const b=document.createElement('button');b.className='thumb';b.dataset.id=item.id;b.title=item.prompt;
    const img=document.createElement('img');img.src=item.src;img.alt=item.prompt;img.loading='lazy';
    const div=document.createElement('div');div.textContent=item.width+' × '+item.height;
    const meta=document.createElement('span');meta.textContent=t('gallerySteps',{n:item.steps,seed:item.seed});div.append(meta);b.append(img,div);b.onclick=()=>selectImage(item);
    const remove=document.createElement('button');remove.className='gallery-delete';remove.textContent=t('galleryDelete');remove.setAttribute('aria-label',t('galleryDeleteAria',{seed:item.seed}));remove.onclick=()=>deleteImages(item);
    const label=document.createElement('label');label.className='image-selection';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.imageId=item.id;checkbox.checked=state.checked.has(item.id);checkbox.setAttribute('aria-label',t('gallerySelectAria',{seed:item.seed}));checkbox.onchange=()=>{if(checkbox.checked)state.checked.add(item.id);else state.checked.delete(item.id);syncSelection();};
    label.append(checkbox,document.createTextNode(t('gallerySelect')));card.append(label,b,remove);$('#gallery').append(card);
  });
  if(!state.gallery.length){$('#result').hidden=true;$('#empty').hidden=false;$('#resultInfo').hidden=true;}
}
async function loadGallery(selectLatest=false) {
  state.gallery=await api('/api/gallery');
  renderGallery();
  state.checked=new Set([...state.checked].filter(id=>state.gallery.some(item=>item.id===id)));
  if(state.selected&&!state.gallery.some(x=>x.id===state.selected.id))state.selected=null;
  refreshForm();
  if(state.gallery.length&&(selectLatest||!state.selected))selectImage(state.gallery[0]);
  else if(state.selected)selectImage(state.selected);
}
$('#reuse').onclick=async()=>{try{const item=state.selected;const refs=await api(`/api/references/${item.id}`);setSettings(item);state.refs=refs.slice(0,2);renderRefs();notice(t('reuseNotice'));$('#prompt').focus();}catch(e){notice(e.message,true);}};
$('#useRef').onclick=async()=>{try{if(state.refs.length>=2)throw new Error(t('errRemoveFirst'));const r=await fetch(state.selected.src);await addFiles([new File([await r.blob()],'referencia.png',{type:'image/png'})]);notice(t('useRefNotice'));}catch(e){notice(e.message,true);}};
async function deleteImages(item=null, ids=null) {
  if(state.job||state.deleting)return;
  const message=ids?t('confirmDeleteSelected',{n:ids.length}):item?t('confirmDeleteItem'):t('confirmDeleteAll',{n:state.gallery.length});
  if(!confirm(message))return;
  state.deleting=true;refreshForm();
  try{await api(ids?'/api/gallery/selection':item?'/api/gallery/'+item.id:'/api/gallery',{method:'DELETE',...(ids?{body:JSON.stringify({ids})}:{})});await loadGallery();notice(ids?t('deletedSelected'):item?t('deletedItem'):t('deletedAll'));}
  catch(e){notice(e.message,true);}
  finally{state.deleting=false;refreshForm();}
}
$('#delete').onclick=()=>{if(state.selected)deleteImages(state.selected);};
$('#deleteAll').onclick=()=>deleteImages();
$('#deleteSelected').onclick=()=>{if(state.checked.size)deleteImages(null,[...state.checked]);};
$('#selectAll').onchange=e=>{state.checked=new Set(e.target.checked?state.gallery.map(item=>item.id):[]);syncSelection();};
function syncSelection(){
  const blocked=!!state.job||state.deleting;
  $('#selectionCount').textContent=t('selectedCount',{n:state.checked.size});
  $('#deleteSelected').disabled=blocked||!state.checked.size;
  const all=$('#selectAll');all.disabled=blocked||!state.gallery.length;all.checked=!!state.gallery.length&&state.checked.size===state.gallery.length;all.indeterminate=state.checked.size>0&&state.checked.size<state.gallery.length;
  document.querySelectorAll('[data-image-id]').forEach(box=>{box.checked=state.checked.has(box.dataset.imageId);box.disabled=blocked;box.closest('.gallery-card').classList.toggle('checked',box.checked);});
}

function showJob(job) {state.job=job;$('#working').hidden=false;$('#workTitle').textContent=t('jobTitle',{current:job.current||1,total:job.total});$('#workMessage').textContent=serverText(job.message);$('#elapsed').textContent=`${Math.round((Date.now()-job.startedAt)/1000)} s`;$('#cancel').disabled=job.cancelRequested;$('#cancel').textContent=job.cancelRequested?t('jobCancelWait'):t('jobCancel');refreshForm();}
async function followJob(id) {
  if(state.polling)return;state.polling=true;
  try{while(true){const job=await api(`/api/jobs/${id}`);showJob(job);if(['completed','failed','cancelled'].includes(job.status)){state.job=null;$('#working').hidden=true;notice(job.message,job.status==='failed');await loadGallery(job.images.length>0);break;}await new Promise(r=>setTimeout(r,400));}}
  catch(e){state.job=null;$('#working').hidden=true;notice(t('jobPollError',{error:e.message}),true);}
  finally{state.polling=false;refreshForm();}
}
$('#form').onsubmit=async e=>{e.preventDefault();if(state.job||state.modelsBusy||state.loading){refreshForm();return;}$('#generate').disabled=true;$('#notice').hidden=true;try{const job=await api('/api/jobs',{method:'POST',body:JSON.stringify({...settings(),refs:state.refs})});showJob(job);void followJob(job.id);}catch(e){notice(e.message,true);refreshForm();}};
$('#cancel').onclick=async()=>{if(!state.job)return;try{const job=await api(`/api/jobs/${state.job.id}/cancel`,{method:'POST',body:'{}'});showJob(job);}catch(e){notice(e.message,true);}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(state.ready&&!state.job&&!state.modelsBusy&&!state.loading)$('#form').requestSubmit();}});
let statusTimer = null;
async function status() {let loading=false;try{const s=await api('/api/status');state.ready=s.ready;state.modelsBusy=!!s.modelsBusy;loading=!!s.compute?.loading;state.loading=loading;
if(s.compute?.hardware){const h=s.compute.hardware,first=!state.hardware;state.hardware=h;const gpuText=h.gpus.length?'GPU: '+h.gpus.map(g=>g.name+(g.integrated?' '+t('hwGpuIntegrated'):'')).join(', '):t('hwNoGpu');$('#hardwareInfo').textContent=`${h.cpuName} · ${t('hwThreads',{n:h.logicalCores})} · ${h.ramGB} GB RAM. ${gpuText}`;for(const o of $('#compute').options)o.disabled=!h.modes.includes(o.value);
$('#fastAttention').closest('label').hidden=!h.gpus.some(g=>/^cuda/i.test(g.id));
$('#engineInfo').textContent=serverText(s.model)+' · '+(s.loraApplication==='merged'?t('engineMerged'):s.loraApplication==='runtime'?t('engineRuntime'):'')+t('engineTail');
if(first)warmEngine();}
const current=s.compute?.current;$('#status').classList.toggle('ready',s.ready&&!loading&&!state.modelsBusy);$('#statusText').textContent=state.modelsBusy?t('statusDownloading'):s.ready?(loading?t('statusLoadingModels'):current?t('statusEngineReady',{mode:({cpu:'CPU',gpu:'GPU',hybrid:'CPU + GPU'}[current.mode]||current.mode)}):t('statusReady')):t('statusDetecting');if(s.active&&!state.job){showJob(s.active);void followJob(s.active.id);}}catch{state.ready=false;state.modelsBusy=false;state.loading=false;$('#status').classList.remove('ready');$('#statusText').textContent=t('statusDisconnected');}refreshForm();clearTimeout(statusTimer);statusTimer=setTimeout(status,loading||state.modelsBusy?1500:5000);}

const numberPresets={width:[512,768,1024,1152,1344,1536,2048],height:[512,768,864,1024,1152,1344,1536,2048],steps:[4,5,6,7,8,12,20,30,40],threads:[0,2,4,8,12,16,24,32],seed:[-1,0,42,12345,424242]};
const numberLabelKeys={width:'width',height:'height',steps:'steps',seed:'seed',threads:'threads'};
function closeNumberMenus(){document.querySelectorAll('.number-options').forEach(menu=>menu.hidden=true);document.querySelectorAll('.number-combo input').forEach(input=>input.setAttribute('aria-expanded','false'));}
function buildNumberCombos(){
  document.querySelectorAll('.number-combo').forEach(wrapper=>{const input=wrapper.querySelector('input');wrapper.before(input);wrapper.remove();});
  for(const [key,values] of Object.entries(numberPresets)){
    const input=$('#'+key), wrapper=document.createElement('div');wrapper.className='number-combo';input.before(wrapper);wrapper.append(input);
    const label=t(numberLabelKeys[key]);
    input.setAttribute('role','combobox');input.setAttribute('aria-label',label);input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',key+'-options');input.setAttribute('aria-autocomplete','list');
    const toggle=document.createElement('button');toggle.type='button';toggle.className='number-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label',t('numberOptions',{label:label.toLowerCase()}));
    const menu=document.createElement('div');menu.id=key+'-options';menu.className='number-options';menu.role='listbox';menu.setAttribute('aria-label',t('numberValues',{label:label.toLowerCase()}));menu.hidden=true;
    function open(){closeNumberMenus();menu.hidden=false;input.setAttribute('aria-expanded','true');menu.querySelectorAll('[role=option]').forEach(option=>option.setAttribute('aria-selected',String(option.dataset.value===input.value)));}
    toggle.onclick=()=>{if(menu.hidden)open();else closeNumberMenus();};
    input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();menu.firstElementChild.focus();}if(e.key==='Escape')closeNumberMenus();});
    input.addEventListener('input',closeNumberMenus);
    for(const n of values){const option=document.createElement('button');option.type='button';option.role='option';option.dataset.value=n;option.textContent=key==='threads'?(n===0?t('numAuto'):t('numThreads',{n})):key==='seed'?(n===-1?t('numRandom'):t('numSeed',{n})):key==='steps'?(n===6?t('numStepsTurbo'):t('numSteps',{n})):n+' px';option.onclick=()=>{input.value=n;closeNumberMenus();input.focus();refreshForm();};menu.append(option);}
    menu.addEventListener('keydown',e=>{const options=[...menu.children],i=options.indexOf(document.activeElement);if(e.key==='Escape'){closeNumberMenus();input.focus();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();}});
    wrapper.append(toggle,menu);
  }
}
document.addEventListener('click',e=>{if(!e.target.closest('.number-combo'))closeNumberMenus();});

try{if(localStorage.getItem('turbo.theme')==='dark')document.body.classList.add('dark');const saved=JSON.parse(localStorage.getItem('turbo.settings')||'null');if(saved)setSettings(saved);}catch{}
try{if(localStorage.getItem('turbo.modelVersion')!=='0.2.1'){$('#steps').value=6;localStorage.setItem('turbo.modelVersion','0.2.1');}}catch{}

/* ---------------- Model manager ---------------- */
const models={open:false,data:null,applying:false,confirm:null,hadPending:false,timer:null};
const sizeLabel=bytes=>bytes==null?'—':bytes>=1024**3?(bytes/1024**3).toFixed(2)+' GB':Math.max(1,Math.round(bytes/1024**2))+' MB';
const downloadStateLabel=()=>({queued:t('downloadQueued'),downloading:t('downloadDownloading'),verifying:t('downloadVerifying'),converting:t('downloadConverting'),done:t('downloadDone'),cancelled:t('downloadCancelled'),error:t('downloadError')});
function modelMessage(text,error=false){const box=$('#modelsNotice');box.hidden=!text;box.textContent=serverText(text||'');box.classList.toggle('error',!!error);}
function modelBadge(text,kind=''){const span=document.createElement('span');span.className='model-badge'+(kind?' '+kind:'');span.textContent=text;return span;}
function activeItem(role){return models.data?models.data.items.find(item=>item.role===role&&item.active)||null:null;}
function selectionItems(selection){
  if(!models.data||!selection)return [];
  const byId=new Map(models.data.items.map(item=>[item.id,item]));
  const required=[selection.textEncoder,selection.mmproj,selection.vae,selection.diffusion].map(id=>byId.get(id)).filter(Boolean);
  const diffusion=byId.get(selection.diffusion);
  if(!diffusion||diffusion.kind!=='merged'){
    const lora=byId.get(selection.lora);if(lora)required.push(lora);
  }
  return required;
}
function modelActionButton(label,variant,onclick,disabled=false){const b=document.createElement('button');b.type='button';b.className=variant;b.textContent=label;b.disabled=disabled;b.onclick=onclick;return b;}
function renderModels(){
  const data=models.data,body=$('#modelsBody');if(!data)return;
  body.replaceChildren();
  for(const role of data.roles){
    const group=document.createElement('section');group.className='models-group';
    const head=document.createElement('div');head.className='models-group-head';
    const title=document.createElement('h3');title.textContent=localRole(role,'label');
    const hint=document.createElement('p');hint.className='hint';hint.textContent=localRole(role,'hint');
    head.append(title,hint);group.append(head);
    if(role.id==='lora'&&activeItem('diffusion')?.kind==='merged'){
      const note=document.createElement('p');note.className='models-note';note.textContent=t('modelLoraNote');group.append(note);
    }
    for(const item of data.items.filter(entry=>entry.role===role.id))group.append(modelRow(item,role));
    body.append(group);
  }
  renderModelsFooter();
}
function modelRow(item,role){
  const data=models.data,state=item.state;
  // A download in another row does not block activating or deleting this one.
  const busy=models.applying||!!data.jobActive;
  const loraBlocked=role.id==='lora'&&activeItem('diffusion')?.kind==='merged';
  const row=document.createElement('div');row.className='model-row'+(item.installed?'':' missing')+(item.active?' is-active':'');
  const info=document.createElement('div');info.className='model-info';
  const name=document.createElement('div');name.className='model-name';const strong=document.createElement('strong');strong.textContent=localItem(item,'label');name.append(strong);
  if(item.active)name.append(modelBadge(t('modelBadgeActive'),'active'));
  if(data.pending?.[role.id]===item.id)name.append(modelBadge(t('modelBadgePending'),'pending'));
  if(item.installed&&!item.active)name.append(modelBadge(t('modelBadgeInstalled')));
  if(item.local)name.append(modelBadge(t('modelBadgeLocal')));
  if(!item.installed&&!item.downloadable)name.append(modelBadge(t('modelBadgeUnavailable'),'warn'));
  const detail=document.createElement('small');detail.textContent=localItem(item,'detail');info.append(name,detail);
  if(state&&['queued','downloading','verifying','converting','error'].includes(state.state)){
    const line=document.createElement('div');line.className='model-progress-line';
    const text=document.createElement('span');text.textContent=downloadStateLabel()[state.state]+(state.state==='downloading'&&state.total?' · '+t('modelDownloadingOf',{a:sizeLabel(state.received),b:sizeLabel(state.total)}):'');
    line.append(text);
    const bar=document.createElement('div');bar.className='model-progress'+(state.state==='error'?' error':'');
    const fill=document.createElement('i');fill.style.width=state.total?Math.min(100,Math.round(state.received/state.total*100))+'%':'0%';bar.append(fill);line.append(bar);
    if(state.error){const err=document.createElement('small');err.className='model-error';err.textContent=state.error;line.append(err);}
    info.append(line);
  }
  const size=document.createElement('span');size.className='model-size';size.textContent=sizeLabel(item.bytes);
  const actions=document.createElement('div');actions.className='model-actions';
  if(models.confirm===item.id){
    const question=document.createElement('span');question.className='model-confirm-text';question.textContent=item.local?t('modelConfirmLocal'):t('modelConfirmDisk');
    actions.append(question,modelActionButton(t('modelYesDelete'),'secondary danger',()=>deleteModel(item)),modelActionButton(t('modelNo'),'secondary',()=>{models.confirm=null;renderModels();}));
  }else if(state&&['queued','downloading'].includes(state.state)){
    actions.append(modelActionButton(t('modelCancelDownload'),'secondary',()=>cancelModel(item)));
  }else if(state&&['verifying','converting'].includes(state.state)){
    actions.append(modelActionButton(t('modelVerifying'),'secondary',()=>{},true));
  }else if(item.active&&item.installed){
    // The active variant is shown by its badge and offers no actions.
  }else if(!item.installed&&item.downloadable){
    actions.append(modelActionButton(t('modelDownload'),'secondary',()=>downloadModel(item),!item.canDownload));
  }else if(item.installed){
    const activate=modelActionButton(t('modelActivate'),'secondary',()=>activateModel(item),busy||loraBlocked);
    if(loraBlocked)activate.title=t('modelLoraBlockedTitle');
    else if(busy)activate.title=t('modelBusyTitle');
    const remove=modelActionButton(t('modelDelete'),'secondary danger',()=>{models.confirm=item.id;renderModels();},busy||!item.canDelete);
    if(item.deleteBlock)remove.title=serverText(item.deleteBlock);
    actions.append(activate,remove);
  }
  row.append(info,size,actions);return row;
}
function renderModelsFooter(){
  const data=models.data;if(!data)return;
  const selection=data.pending||data.selection,required=selectionItems(selection);
  const missing=required.filter(item=>!item.installed);
  const total=required.reduce((sum,item)=>sum+(item.bytes||0),0),missingBytes=missing.reduce((sum,item)=>sum+(item.bytes||0),0);
  const disk=data.disk?t('modelFooterDisk',{size:sizeLabel(data.disk.freeBytes)}):'';
  $('#modelsDisk').textContent=data.ramGB?t('modelDiskRam',{ram:data.ramGB})+disk:disk.replace(/^ · /,'');
  const summaryStatus=data.pending?t('modelFooterPending'):t('modelFooterActive');
  const summaryMissing=missing.length?t('modelFooterMissing',{n:missing.length,size:sizeLabel(missingBytes)}):t('modelFooterAll');
  $('#modelsSummary').textContent=`${summaryStatus}: ${sizeLabel(total)} · ${summaryMissing}${disk}`;
  $('#modelsCancel').textContent=t('modelsClose');
}
async function refreshModels(){
  try{
    const data=await api('/api/models');models.data=data;if(!models.applying){state.modelsBusy=!!(data.downloading||data.pending);refreshForm();}
    if(data.pending)models.hadPending=true;
    else if(models.hadPending){
      models.hadPending=false;
      if(models.open)modelMessage(t('modelVerified'));
      warmedKey=null;
    }
    if(models.open)renderModels();
  }catch(error){if(models.open)modelMessage(error.message,true);}
}
function scheduleModelPoll(delay=1500){
  clearTimeout(models.timer);
  models.timer=setTimeout(async()=>{
    if(!models.open)return;
    await refreshModels();
    const busy=models.data?.downloading||models.data?.pending||models.applying;
    scheduleModelPoll(busy?1200:5000);
  },delay);
}
async function openModels(){
  if(models.open)return;
  models.open=true;models.confirm=null;models.hadPending=false;modelMessage('');
  const dialog=$('#modelsDialog');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  $('#modelsBody').replaceChildren(Object.assign(document.createElement('p'),{className:'hint',textContent:t('modelsLoading')}));
  await refreshModels();
  scheduleModelPoll(1200);
}
function closeModels(){
  if(models.applying)return;
  models.open=false;clearTimeout(models.timer);models.confirm=null;
  const dialog=$('#modelsDialog');
  if(dialog.open)dialog.close();else dialog.removeAttribute('open');
}
async function downloadModel(item){
  try{await api('/api/models/download',{method:'POST',body:JSON.stringify({id:item.id})});state.modelsBusy=true;refreshForm();modelMessage(t('modelDownloadStart',{name:item.short}));await refreshModels();scheduleModelPoll(600);}
  catch(error){modelMessage(error.message,true);}
}
async function cancelModel(item){
  try{await api('/api/models/cancel',{method:'POST',body:JSON.stringify({id:item.id})});modelMessage(t('modelCancelMsg',{name:item.short}));await refreshModels();}
  catch(error){modelMessage(error.message,true);}
}
async function deleteModel(item){
  try{
    const result=await api('/api/models/delete',{method:'POST',body:JSON.stringify({id:item.id})});models.confirm=null;
    modelMessage(t('modelDeleted',{name:item.short})+(result.pendingCleared?t('modelPendingCleared'):''));await refreshModels();
  }
  catch(error){modelMessage(error.message,true);}
}
async function activateModel(item){
  if(!models.data||models.applying)return;
  models.applying=true;models.confirm=null;modelMessage(t('modelActivating',{name:item.short}));renderModels();
  try{
    const selection={...models.data.selection,[item.role]:item.id};
    const result=await api('/api/models/select',{method:'POST',body:JSON.stringify({selection})});
    if(result.pending){
      models.hadPending=true;state.modelsBusy=true;refreshForm();
      modelMessage(t('modelMissingFiles',{n:result.downloads.length,name:item.short}));
    }else{
      warmedKey=null;
      modelMessage(result.restarted?t('modelActivatedRestart',{name:item.short}):t('modelActivated',{name:item.short}));
      if(result.restarted){state.modelsBusy=true;refreshForm();}else warmEngine();
    }
    await refreshModels();
  }catch(error){modelMessage(error.message,true);}
  finally{models.applying=false;renderModels();scheduleModelPoll(800);}
}
$('#models').onclick=openModels;
$('#modelsClose').onclick=closeModels;
$('#modelsCancel').onclick=closeModels;
$('#modelsDialog').addEventListener('close',()=>{models.open=false;clearTimeout(models.timer);models.confirm=null;});
$('#modelsDialog').addEventListener('cancel',event=>{if(models.applying)event.preventDefault();});
$('#modelsDialog').addEventListener('click',event=>{if(event.target===$('#modelsDialog'))closeModels();});

applyLanguage();
loadGallery().catch(e=>notice(e.message,true));
