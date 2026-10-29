/* ==========================================================================
   OrgRise — Motor de Juego y Validación Organizacional (Port fiel de Unity 6)
   Scripts equivalentes:
   - DailyStreakManager.cs
   - EmployeeNode.cs
   - OrgValidator.cs
   - ProceduralLevelGenerator.cs
   - WildcardManager.cs
   - TutorialManager.cs
   - FeedbackManager.cs
   - UINodeInteraction.cs & UILineConnection.cs
   - LevelManager.cs
   ========================================================================== */

(function () {
  'use strict';

  // ==================== ENUMS (EmployeeNode.cs) ====================
  const NivelJerarquico = {
    CEO: 0,
    Director: 1,
    Gerente: 2,
    EmpleadoBase: 3
  };

  const Departamento = {
    General: 'General',
    Finanzas: 'Finanzas',
    Comercial: 'Comercial',
    Operaciones: 'Operaciones',
    Tecnologia: 'Tecnologia'
  };

  const CriterioDepartamentalizacion = {
    Funcional: 'Funcional',
    PorProducto: 'PorProducto',
    Geografica: 'Geografica',
    Matricial: 'Matricial'
  };

  const ModoAutoridad = {
    Equilibrada: 'Equilibrada',
    Centralizada: 'Centralizada',
    Descentralizada: 'Descentralizada'
  };

  function obtenerEtiquetaNivel(nivel) {
    switch (nivel) {
      case NivelJerarquico.CEO: return 'Nivel Estratégico';
      case NivelJerarquico.Director: return 'Nivel Ejecutivo';
      case NivelJerarquico.Gerente: return 'Nivel Táctico';
      case NivelJerarquico.EmpleadoBase: return 'Nivel Operativo';
      default: return String(nivel);
    }
  }

  // ==================== PRNG DETERMINISTA (Semilla idéntica por nivel/día) ====================
  class SeededRandom {
    constructor(seed) {
      this.state = (seed >>> 0) || 1;
    }
    nextFloat() {
      let t = (this.state += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rangeInt(minInclusive, maxExclusive) {
      if (maxExclusive <= minInclusive) return minInclusive;
      return minInclusive + Math.floor(this.nextFloat() * (maxExclusive - minInclusive));
    }
  }

  // ==================== AUDIO & FEEDBACK MANAGER (FeedbackManager.cs) ====================
  const FeedbackManager = {
    muted: false,
    audioCtx: null,
    snapAudio: null,
    winAudio: null,
    toastTimer: null,

    init() {
      try {
        this.snapAudio = new Audio('assets/sounds/card_flip.ogg');
        this.snapAudio.preload = 'auto';
        this.winAudio = new Audio('assets/sounds/qte_success.ogg');
        this.winAudio.preload = 'auto';
      } catch (e) {
        this.snapAudio = null;
        this.winAudio = null;
      }
    },

    ensureAudioCtx() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    },

    toggleMute() {
      this.muted = !this.muted;
      const btn = document.getElementById('btnToggleSound');
      if (btn) {
        btn.textContent = this.muted ? '🔇' : '🔊';
        btn.setAttribute('aria-label', this.muted ? 'Activar sonido' : 'Silenciar sonido');
      }
      this.mostrarMensajeEstado(
        this.muted ? '🔇 Sonido silenciado.' : '🔊 Sonido activado.',
        'rgba(35, 48, 68, 0.94)',
        1.5
      );
    },

    playTone(freq, durationMs, type, gainVal) {
      if (this.muted) return;
      try {
        this.ensureAudioCtx();
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(gainVal || 0.12, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationMs / 1000);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + durationMs / 1000);
      } catch (e) {}
    },

    playSnapFeedback(nodeObj, mensaje) {
      if (!this.muted) {
        let playedFile = false;
        if (this.snapAudio) {
          try {
            this.snapAudio.currentTime = 0;
            this.snapAudio.playbackRate = 0.96 + Math.random() * 0.12;
            const p = this.snapAudio.play();
            if (p && typeof p.catch === 'function') p.catch(() => this.playTone(520, 110, 'sine', 0.14));
            playedFile = true;
          } catch (e) {}
        }
        if (!playedFile) {
          this.playTone(520, 110, 'sine', 0.14);
        }
      }

      if (nodeObj && nodeObj.el) {
        nodeObj.el.classList.remove('anim-pop');
        void nodeObj.el.offsetWidth;
        nodeObj.el.classList.add('anim-pop');
      }

      if (mensaje) {
        this.mostrarMensajeEstado(mensaje, 'rgba(31, 115, 56, 0.95)', 2.4);
      }
    },

    playErrorFeedback(targetNode, motivo) {
      if (!this.muted) {
        this.playTone(190, 220, 'sawtooth', 0.12);
      }

      if (targetNode && targetNode.el) {
        targetNode.el.classList.remove('anim-error');
        void targetNode.el.offsetWidth;
        targetNode.el.classList.add('anim-error');
        setTimeout(() => {
          if (targetNode.el) targetNode.el.classList.remove('anim-error');
        }, 300);
      }

      if (motivo) {
        this.mostrarMensajeEstado('⚠️ ' + motivo, 'rgba(173, 36, 36, 0.96)', 3.8);
      }
    },

    playVictoryFeedback(nodes) {
      if (!this.muted) {
        let playedFile = false;
        if (this.winAudio) {
          try {
            this.winAudio.currentTime = 0;
            const p = this.winAudio.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
            playedFile = true;
          } catch (e) {}
        }
        if (!playedFile) {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 220, 'triangle', 0.15), idx * 90);
          });
        }
      }

      if (Array.isArray(nodes)) {
        nodes.forEach((node, idx) => {
          setTimeout(() => {
            if (node && node.el) {
              node.el.classList.remove('anim-pop');
              void node.el.offsetWidth;
              node.el.classList.add('anim-pop');
            }
          }, idx * 75);
        });
      }
    },

    mostrarMensajeEstado(texto, colorFondo, duracionSegundos) {
      const toast = document.getElementById('academicToastBanner');
      if (!toast) return;
      if (this.toastTimer) clearTimeout(this.toastTimer);

      toast.textContent = texto;
      toast.style.backgroundColor = colorFondo || 'rgba(38, 51, 71, 0.95)';
      toast.classList.add('visible');

      const ms = (duracionSegundos || 3.0) * 1000;
      this.toastTimer = setTimeout(() => {
        toast.classList.remove('visible');
      }, ms);
    }
  };

  // ==================== DAILY STREAK MANAGER (DailyStreakManager.cs) ====================
  const DailyStreakManager = {
    lastPlayDateKey: 'OrgRise_LastPlayDate',
    currentStreakKey: 'OrgRise_CurrentStreak',
    currentStreak: 0,
    alreadyPlayedToday: false,

    getTodayString() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },

    loadStreakData() {
      let storedStreak = 0;
      let lastDateStr = '';
      try {
        storedStreak = parseInt(localStorage.getItem(this.currentStreakKey) || '0', 10) || 0;
        lastDateStr = localStorage.getItem(this.lastPlayDateKey) || '';
      } catch (e) {
        storedStreak = 0;
        lastDateStr = '';
      }

      this.currentStreak = storedStreak;
      const todayStr = this.getTodayString();

      if (lastDateStr) {
        const partsLast = lastDateStr.split('-').map(Number);
        const partsToday = todayStr.split('-').map(Number);
        if (partsLast.length === 3 && partsToday.length === 3) {
          const lastUTC = Date.UTC(partsLast[0], partsLast[1] - 1, partsLast[2]);
          const todayUTC = Date.UTC(partsToday[0], partsToday[1] - 1, partsToday[2]);
          const diffDays = Math.round((todayUTC - lastUTC) / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
            this.alreadyPlayedToday = true;
          } else if (diffDays === 1) {
            this.alreadyPlayedToday = false;
          } else if (diffDays > 1) {
            this.currentStreak = 0;
            this.alreadyPlayedToday = false;
            try {
              localStorage.setItem(this.currentStreakKey, '0');
            } catch (e) {}
          }
        }
      } else {
        this.alreadyPlayedToday = false;
      }
      StreakUI.actualizarPantalla();
    },

    registerWin() {
      if (!this.alreadyPlayedToday) {
        this.currentStreak += 1;
        this.alreadyPlayedToday = true;
        try {
          localStorage.setItem(this.currentStreakKey, String(this.currentStreak));
          localStorage.setItem(this.lastPlayDateKey, this.getTodayString());
        } catch (e) {}
      }
      StreakUI.actualizarPantalla();
    }
  };

  // ==================== STREAK UI (StreakUI.cs) ====================
  const StreakUI = {
    actualizarPantalla() {
      const el = document.getElementById('textRacha');
      if (el) {
        el.textContent = `🔥 ${DailyStreakManager.currentStreak}`;
      }
      const menuBadge = document.getElementById('streakBadgeText');
      if (menuBadge) {
        const racha = DailyStreakManager.currentStreak;
        const estadoHoy = DailyStreakManager.alreadyPlayedToday ? 'Completado hoy ✓' : 'Disponible hoy';
        menuBadge.innerHTML = `🔥 Racha: <b>${racha} días</b> &nbsp;|&nbsp; Puzzle Diario: <span style="color:#80cbc4;font-weight:700;">${estadoHoy}</span>`;
      }
    }
  };

  // ==================== ORG VALIDATOR (OrgValidator.cs) ====================
  const OrgValidator = {
    checkForCycles(potentialManager, newSubordinate) {
      let current = potentialManager;
      let safetyCounter = 0;
      while (current !== null && safetyCounter < 100) {
        if (current === newSubordinate) {
          return true;
        }
        current = current.manager;
        safetyCounter++;
      }
      return false;
    },

    connectsToRoot(node, rootNode) {
      if (!node || !rootNode) return false;
      if (node === rootNode) return true;
      let current = node.manager;
      let safetyCounter = 0;
      while (current !== null && safetyCounter < 100) {
        if (current === rootNode) return true;
        current = current.manager;
        safetyCounter++;
      }
      return false;
    },

    validateWinCondition(levelNodes, rootNode) {
      if (!levelNodes || levelNodes.length === 0) return false;
      if (!rootNode) {
        rootNode = levelNodes.find(n => n && n.isRootNode) || null;
      }
      if (!rootNode) return false;

      let connectedNodes = 0;
      for (const node of levelNodes) {
        if (!node) continue;
        if (node.directReports.length > node.maxDirectReports) {
          return false;
        }
        if (this.connectsToRoot(node, rootNode)) {
          connectedNodes++;
        }
      }
      return connectedNodes === levelNodes.length;
    }
  };

  // ==================== EMPLOYEE NODE (EmployeeNode.cs) ====================
  class EmployeeNode {
    constructor(config) {
      this.id = config.id;
      this.roleName = config.roleName;
      this.displayTitle = config.displayTitle;
      this.nivel = config.nivel;
      this.departamento = config.departamento;
      this.maxDirectReports = config.maxDirectReports;
      this.isRootNode = Boolean(config.isRootNode);
      this.baseColor = config.baseColor || '#ffffff';

      this.manager = null;
      this.directReports = [];

      // Coordenadas porcentuales dentro de SpawnArea
      this.xPercent = config.xPercent;
      this.yPercent = config.yPercent;
      this.widthPercent = config.widthPercent;
      this.heightPercent = config.heightPercent;

      this.el = null;
      this.titleEl = null;
      this.spanEl = null;
    }

    tryAssignManager(newManager) {
      if (!newManager || newManager === this) {
        return { ok: false, motivo: 'No se puede conectar un rol consigo mismo.' };
      }

      if (this.isRootNode) {
        return {
          ok: false,
          motivo: 'Cadena de Mando: La Dirección General (CEO) es la cima estratégica y no reporta a otro nodo.'
        };
      }

      if (this.manager === newManager) {
        return { ok: false, motivo: 'Este rol ya reporta a ese superior.' };
      }

      // 1. Validar Cadena de Mando / Jerarquía
      if (newManager.nivel >= this.nivel) {
        return {
          ok: false,
          motivo: `Cadena de Mando inválida: ${this.roleName} (${obtenerEtiquetaNivel(this.nivel)}) debe reportar a un nivel jerárquico superior, no a ${newManager.roleName} (${obtenerEtiquetaNivel(newManager.nivel)}).`
        };
      }

      // Evitar saltos de línea jerárquica cuando existen mandos medios activos en el nivel
      if (LevelManager.exigirCadenaEstricta) {
        const diferenciaNivel = this.nivel - newManager.nivel;
        if (diferenciaNivel > 1 && LevelManager.existeNivelIntermedioParaArea(this.nivel, this.departamento)) {
          return {
            ok: false,
            motivo: `Respeto del Conducto Regular: ${this.roleName} debe reportar a su mando inmediato superior antes de saltar directamente a ${newManager.roleName}.`
          };
        }
      }

      // 2. Validar Departamentalización
      const esMatricial = LevelManager.criterioActual === CriterioDepartamentalizacion.Matricial;
      if (
        newManager.nivel !== NivelJerarquico.CEO &&
        newManager.departamento !== Departamento.General &&
        newManager.departamento !== this.departamento
      ) {
        if (!(esMatricial && this.nivel === NivelJerarquico.EmpleadoBase && newManager.nivel === NivelJerarquico.Gerente)) {
          const etiquetaPropia = LevelManager.obtenerNombreDepartamento(this.departamento);
          const etiquetaJefe = LevelManager.obtenerNombreDepartamento(newManager.departamento);
          return {
            ok: false,
            motivo: `Departamentalización: ${this.roleName} pertenece a [${etiquetaPropia}] y no puede reportar a [${etiquetaJefe}].`
          };
        }
      }

      // 3. Validar Tramo de Control (Span of Control)
      if (newManager.directReports.length >= newManager.maxDirectReports) {
        return {
          ok: false,
          motivo: `Tramo de Control excedido: ${newManager.roleName} ya alcanzó su límite máximo de ${newManager.maxDirectReports} reportes directos (cuello de botella).`
        };
      }

      // 4. Validar Ciclos Cerrados
      if (OrgValidator.checkForCycles(newManager, this)) {
        return {
          ok: false,
          motivo: 'Conflicto de Autoridad: Esta conexión generaría un ciclo cerrado en la jerarquía.'
        };
      }

      const previousManager = this.manager;
      this.removeCurrentManager();

      this.manager = newManager;
      newManager.directReports.push(this);

      if (previousManager) previousManager.refreshNodeVisuals();
      newManager.refreshNodeVisuals();
      this.refreshNodeVisuals();

      return { ok: true, motivo: '' };
    }

    removeCurrentManager() {
      if (this.manager) {
        const oldManager = this.manager;
        oldManager.directReports = oldManager.directReports.filter(n => n !== this);
        this.manager = null;
        oldManager.refreshNodeVisuals();
        this.refreshNodeVisuals();
      }
    }

    refreshNodeVisuals() {
      if (!this.el) return;
      this.el.style.backgroundColor = this.baseColor;
      if (this.titleEl) {
        this.titleEl.textContent = this.displayTitle || this.roleName;
      }
      if (this.spanEl) {
        if (this.maxDirectReports > 0) {
          const actuales = this.directReports.length;
          const lleno = actuales >= this.maxDirectReports;
          this.spanEl.className = 'node-span-info ' + (lleno ? 'span-full' : 'span-ok');
          this.spanEl.textContent = `Tramo: ${actuales}/${this.maxDirectReports}`;
        } else {
          const conectado = Boolean(this.manager || this.isRootNode);
          this.spanEl.className = 'node-span-info ' + (conectado ? 'span-ok' : 'span-idle');
          this.spanEl.textContent = (conectado ? '●' : '○') + ' Operativo';
        }
      }
    }
  }

  // ==================== WILDCARD MANAGER (WildcardManager.cs) ====================
  const WildcardManager = {
    wildcardsDisponibles: 2,
    comodinActivo: false,

    init() {
      const btn = document.getElementById('comodinButton');
      if (btn) {
        btn.addEventListener('click', () => this.toggleComodin());
      }
      this.actualizarUI();
    },

    toggleComodin() {
      if (this.wildcardsDisponibles > 0) {
        this.comodinActivo = !this.comodinActivo;
        this.actualizarUI();
        const msg = this.comodinActivo
          ? 'Comodín ACTIVO: ahora podés mover o desconectar un mando con toda su rama a cargo.'
          : 'Modo Comodín desactivado.';
        const col = this.comodinActivo
          ? 'rgba(191, 133, 20, 0.95)'
          : 'rgba(51, 64, 82, 0.92)';
        FeedbackManager.mostrarMensajeEstado(msg, col, 2.8);
      } else {
        this.recompensarComodin(1);
        FeedbackManager.mostrarMensajeEstado(
          'Consultoría Organizacional: +1 Comodín de Reestructuración otorgado.',
          'rgba(46, 107, 173, 0.95)',
          2.6
        );
      }
    },

    consumirComodin() {
      this.wildcardsDisponibles = Math.max(0, this.wildcardsDisponibles - 1);
      this.comodinActivo = false;
      this.actualizarUI();
    },

    recompensarComodin(cantidad) {
      this.wildcardsDisponibles += cantidad;
      this.actualizarUI();
    },

    actualizarUI() {
      const btn = document.getElementById('comodinButton');
      const label = document.getElementById('comodinLabel');
      const count = document.getElementById('textoContador');
      if (count) count.textContent = `x${this.wildcardsDisponibles}`;
      if (label) {
        label.textContent = this.comodinActivo
          ? '⚡ Reestructuración [ON]'
          : '⚡ Comodín Reestructurar';
      }
      if (btn) {
        btn.classList.toggle('active', this.comodinActivo);
      }
    }
  };

  // ==================== TUTORIAL & VICTORY MODAL MANAGER (TutorialManager.cs) ====================
  const TutorialManager = {
    pasoActual: 0,
    tutorialActivo: false,
    enPantallaVictoria: false,
    tutorialYaMostradoEnSesion: false,

    instrucciones: [
      '<b>🏢 Bienvenido a OrgRise</b>\n\nTu objetivo es diseñar estructuras organizacionales eficientes aplicando los principios de <b>Gestión de la Organización</b>.',
      '<b>1. Cadena y Unidad de Mando</b>\n\nArrastrá una línea entre un subordinado y su jefe inmediato (Empleado → Gerente → Director → CEO).\n\nPodés cerrar este aviso y hacer tu primera conexión.',
      '<b>2. Tramo de Control</b>\n\nCada superior tiene un límite máximo de reportes directos (<b>Tramo: X/Max</b>). Si lo superás, se produce un cuello de botella.',
      '<b>3. Departamentalización y Reestructuración</b>\n\nRespetá el área/color de cada unidad. Hacé <b>doble clic / doble toque</b> sobre un nodo para desconectarlo, o usá el <b>Comodín</b> para mover una rama completa.'
    ],

    init() {
      const btnCont = document.getElementById('botonContinuar');
      if (btnCont) {
        btnCont.addEventListener('click', () => this.alPresionarBotonPrincipal());
      }
      const btnMenu = document.getElementById('botonVolverAlMenuModal');
      if (btnMenu) {
        btnMenu.addEventListener('click', () => {
          this.ocultarPanelInmediato();
          LevelManager.mostrarMenuPrincipal();
        });
      }
    },

    ocultarPanelInmediato() {
      this.tutorialActivo = false;
      this.enPantallaVictoria = false;
      const panel = document.getElementById('tutorialPanel');
      if (panel) panel.classList.add('hidden');
    },

    iniciarTutorial() {
      if (this.tutorialYaMostradoEnSesion) {
        this.ocultarPanelInmediato();
        return;
      }
      this.tutorialYaMostradoEnSesion = true;
      this.enPantallaVictoria = false;
      this.tutorialActivo = true;
      this.pasoActual = 0;

      const btnMenu = document.getElementById('botonVolverAlMenuModal');
      if (btnMenu) btnMenu.classList.add('hidden');

      const panel = document.getElementById('tutorialPanel');
      if (panel) panel.classList.remove('hidden');

      this.mostrarPaso(this.pasoActual);
    },

    mostrarPaso(indice) {
      if (indice >= this.instrucciones.length) {
        this.finalizarTutorial();
        return;
      }
      const txt = document.getElementById('textoInstruccion');
      if (txt) {
        txt.innerHTML = this.instrucciones[indice];
      }
      const btnCont = document.getElementById('botonContinuar');
      if (btnCont) {
        btnCont.textContent = (indice === this.instrucciones.length - 1)
          ? '¡Empezar a Jugar!'
          : 'Continuar';
      }
    },

    alPresionarBotonPrincipal() {
      if (this.enPantallaVictoria) {
        this.enPantallaVictoria = false;
        this.ocultarPanelInmediato();
        LevelManager.avanzarSiguienteNivel();
        return;
      }
      if (!this.tutorialActivo) {
        this.ocultarPanelInmediato();
        return;
      }
      this.pasoActual++;
      this.mostrarPaso(this.pasoActual);
    },

    notificarConexionExitosa() {
      if (this.tutorialActivo && this.pasoActual === 1) {
        this.pasoActual++;
        this.mostrarPaso(this.pasoActual);
      }
    },

    finalizarTutorial() {
      this.tutorialActivo = false;
      const panel = document.getElementById('tutorialPanel');
      if (panel) panel.classList.add('hidden');
    },

    mostrarPantallaNivelCompletado(resumenAcademico) {
      this.tutorialActivo = false;
      this.enPantallaVictoria = true;

      const panel = document.getElementById('tutorialPanel');
      const txt = document.getElementById('textoInstruccion');
      const btnCont = document.getElementById('botonContinuar');
      const btnMenu = document.getElementById('botonVolverAlMenuModal');

      if (txt) {
        txt.innerHTML = `<span class="modal-victory-heading">¡ORGANIGRAMA VALIDADO!</span>${resumenAcademico}`;
      }
      if (btnCont) {
        btnCont.textContent = 'Siguiente Nivel ➔';
      }
      if (btnMenu) {
        btnMenu.classList.remove('hidden');
      }
      if (panel) {
        panel.classList.remove('hidden');
      }
    }
  };

  // ==================== PROCEDURAL LEVEL GENERATOR (ProceduralLevelGenerator.cs) ====================
  const ProceduralLevelGenerator = {
    nombresCEO: ['CEO', 'Dir. General', 'Presidencia'],
    areasDisponibles: [
      Departamento.Finanzas,
      Departamento.Comercial,
      Departamento.Operaciones,
      Departamento.Tecnologia
    ],
    prefijosDirector: ['Dir.', 'VP', 'Head of'],
    prefijosGerente: ['Gte.', 'Coord.', 'Jefe', 'Líder'],
    prefijosEmpleado: [
      'Analista', 'Especialista', 'Asistente', 'Técnico', 'Consultor',
      'Auditor', 'Operador', 'Diseñador', 'Desarrollador', 'Ejecutivo'
    ],

    obtenerSemillaDiaria() {
      const hoy = new Date();
      return hoy.getFullYear() * 10000 + (hoy.getMonth() + 1) * 100 + hoy.getDate();
    },

    obtenerEtiquetaCriterio(depto, criterio) {
      if (depto === Departamento.General) return 'General';
      switch (criterio) {
        case CriterioDepartamentalizacion.Funcional:
          switch (depto) {
            case Departamento.Finanzas: return 'Finanzas';
            case Departamento.Comercial: return 'Comercial';
            case Departamento.Operaciones: return 'Operaciones';
            case Departamento.Tecnologia: return 'Tecnología';
          }
          break;
        case CriterioDepartamentalizacion.PorProducto:
          switch (depto) {
            case Departamento.Finanzas: return 'Div. PyMEs';
            case Departamento.Comercial: return 'Div. Consumo';
            case Departamento.Operaciones: return 'Div. Industria';
            case Departamento.Tecnologia: return 'Div. Cloud';
          }
          break;
        case CriterioDepartamentalizacion.Geografica:
          switch (depto) {
            case Departamento.Finanzas: return 'Reg. Norte';
            case Departamento.Comercial: return 'Reg. Centro';
            case Departamento.Operaciones: return 'Reg. Sur';
            case Departamento.Tecnologia: return 'Reg. Exterior';
          }
          break;
        case CriterioDepartamentalizacion.Matricial:
          switch (depto) {
            case Departamento.Finanzas: return 'Proy. Alfa';
            case Departamento.Comercial: return 'Proy. Beta';
            case Departamento.Operaciones: return 'Proy. Gamma';
            case Departamento.Tecnologia: return 'Proy. Delta';
          }
          break;
      }
      return String(depto);
    },

    obtenerColorArea(depto) {
      switch (depto) {
        case Departamento.General: return '#f2f5fa';
        case Departamento.Finanzas: return '#a6ebad';
        case Departamento.Comercial: return '#a3d1ff';
        case Departamento.Operaciones: return '#ffd199';
        case Departamento.Tecnologia: return '#e0b8ff';
        default: return '#ffffff';
      }
    },

    obtenerNombreUnico(rng, poolPrefijos, sufijoArea, usados) {
      const pool = poolPrefijos.slice();
      for (let i = 0; i < pool.length; i++) {
        const randomIndex = rng.rangeInt(i, pool.length);
        const temp = pool[i];
        pool[i] = pool[randomIndex];
        pool[randomIndex] = temp;
      }

      for (const prefijo of pool) {
        const candidato = !sufijoArea ? prefijo : `${prefijo}\n${sufijoArea}`;
        if (!usados.has(candidato)) {
          usados.add(candidato);
          return candidato;
        }
      }

      const fallback = !sufijoArea ? pool[0] : `${pool[0]}\n${sufijoArea}`;
      let contador = 2;
      while (usados.has(`${fallback} ${contador}`)) contador++;
      const finalName = `${fallback} ${contador}`;
      usados.add(finalName);
      return finalName;
    },

    limpiarTablero() {
      const nodesLayer = document.getElementById('nodesLayer');
      if (nodesLayer) nodesLayer.innerHTML = '';
      const svg = document.getElementById('connectionsSvg');
      if (svg) svg.innerHTML = '';
      const guides = document.getElementById('tierGuides');
      if (guides) guides.innerHTML = '';
      LevelManager.limpiarNodosRegistrados();
      BoardInteraction.resetSelection();
    },

    generarNivelAcademico(semilla, cantidad, criterio, autoridad) {
      this.limpiarTablero();
      const rng = new SeededRandom(semilla);
      cantidad = Math.max(4, Math.min(12, cantidad));

      if (autoridad === ModoAutoridad.Centralizada) {
        this.generarEstructuraCentralizada(rng, cantidad, criterio);
        BoardInteraction.renderGuides(3);
        return;
      }

      const numDirectores = Math.max(2, Math.min(3, Math.floor(cantidad / 4)));
      const restantes = cantidad - 1 - numDirectores;

      const numGerentes = (autoridad === ModoAutoridad.Descentralizada)
        ? Math.max(numDirectores, Math.min(4, Math.ceil(restantes * 0.45)))
        : Math.max(numDirectores, Math.min(4, Math.floor(restantes / 2)));

      const numEmpleados = Math.max(
        numDirectores,
        Math.min(5, cantidad - 1 - numDirectores - numGerentes)
      );

      const areasActivas = [];
      for (let i = 0; i < numDirectores; i++) {
        areasActivas.push(this.areasDisponibles[i % this.areasDisponibles.length]);
      }

      const deptosGerentes = [];
      for (let i = 0; i < numGerentes; i++) {
        deptosGerentes.push(areasActivas[i % areasActivas.length]);
      }

      const deptosEmpleados = [];
      for (let i = 0; i < numEmpleados; i++) {
        deptosEmpleados.push(areasActivas[i % areasActivas.length]);
      }

      const gerentesPorArea = {};
      const empleadosPorArea = {};
      for (const area of areasActivas) {
        gerentesPorArea[area] = 0;
        empleadosPorArea[area] = 0;
      }
      for (const d of deptosGerentes) gerentesPorArea[d]++;
      for (const d of deptosEmpleados) empleadosPorArea[d]++;

      const nombresUsados = new Set();

      // FILA 0: CEO
      const extraCEO = (autoridad === ModoAutoridad.Descentralizada) ? 0 : 1;
      const cupoCEO = numDirectores + extraCEO;
      const nombreCEO = this.obtenerNombreUnico(rng, this.nombresCEO, '', nombresUsados);
      this.crearNodoUI(NivelJerarquico.CEO, Departamento.General, nombreCEO, true, cupoCEO, 0, 1, 4);

      // FILA 1: Directores
      for (let i = 0; i < numDirectores; i++) {
        const area = areasActivas[i];
        const etiquetaArea = this.obtenerEtiquetaCriterio(area, criterio);
        const nombreDir = this.obtenerNombreUnico(rng, this.prefijosDirector, etiquetaArea, nombresUsados);
        const minNecesarioDir = Math.max(1, gerentesPorArea[area]);
        const holguraDir = (autoridad === ModoAutoridad.Descentralizada) ? 0 : 1;
        const cupoDirector = minNecesarioDir + holguraDir;
        this.crearNodoUI(NivelJerarquico.Director, area, nombreDir, false, cupoDirector, i, numDirectores, 4);
      }

      // FILA 2: Gerentes
      for (let i = 0; i < numGerentes; i++) {
        const area = deptosGerentes[i];
        const totalGerentesArea = gerentesPorArea[area];
        const totalEmpleadosArea = empleadosPorArea[area];
        const cupoMinimoGerente = Math.max(1, Math.ceil(totalEmpleadosArea / totalGerentesArea));
        const holguraGte = (autoridad === ModoAutoridad.Descentralizada) ? 0 : (i % 2 === 0 ? 1 : 0);
        const cupoGerente = cupoMinimoGerente + holguraGte;
        const etiquetaArea = this.obtenerEtiquetaCriterio(area, criterio);
        const nombreGte = this.obtenerNombreUnico(rng, this.prefijosGerente, etiquetaArea, nombresUsados);
        this.crearNodoUI(NivelJerarquico.Gerente, area, nombreGte, false, cupoGerente, i, numGerentes, 4);
      }

      // FILA 3: Empleados Base
      for (let i = 0; i < numEmpleados; i++) {
        const area = deptosEmpleados[i];
        const etiquetaArea = this.obtenerEtiquetaCriterio(area, criterio);
        const nombreEmp = this.obtenerNombreUnico(rng, this.prefijosEmpleado, etiquetaArea, nombresUsados);
        this.crearNodoUI(NivelJerarquico.EmpleadoBase, area, nombreEmp, false, 0, i, numEmpleados, 4);
      }

      BoardInteraction.renderGuides(4);
    },

    generarEstructuraCentralizada(rng, cantidad, criterio) {
      const numMandos = Math.max(2, Math.min(3, Math.floor(cantidad / 3)));
      const numEmpleados = Math.max(2, Math.min(5, cantidad - 1 - numMandos));

      const areasActivas = [];
      for (let i = 0; i < numMandos; i++) {
        areasActivas.push(this.areasDisponibles[i % this.areasDisponibles.length]);
      }

      const nombresUsados = new Set();

      const nombreCEO = this.obtenerNombreUnico(rng, this.nombresCEO, 'Central', nombresUsados);
      this.crearNodoUI(NivelJerarquico.CEO, Departamento.General, nombreCEO, true, numMandos + 1, 0, 1, 3);

      for (let i = 0; i < numMandos; i++) {
        const area = areasActivas[i];
        const etiquetaArea = this.obtenerEtiquetaCriterio(area, criterio);
        const nombreMando = this.obtenerNombreUnico(rng, this.prefijosDirector, etiquetaArea, nombresUsados);
        const empleadosDeEstaArea = Math.ceil(numEmpleados / numMandos) + 1;
        this.crearNodoUI(NivelJerarquico.Director, area, nombreMando, false, empleadosDeEstaArea, i, numMandos, 3);
      }

      for (let i = 0; i < numEmpleados; i++) {
        const area = areasActivas[i % areasActivas.length];
        const etiquetaArea = this.obtenerEtiquetaCriterio(area, criterio);
        const nombreEmp = this.obtenerNombreUnico(rng, this.prefijosEmpleado, etiquetaArea, nombresUsados);
        this.crearNodoUI(NivelJerarquico.EmpleadoBase, area, nombreEmp, false, 0, i, numEmpleados, 3, 2);
      }
    },

    crearNodoUI(nivel, depto, nombre, esRaiz, maxReportes, indexEnFila, totalEnFila, totalFilas, filaVisualOverride) {
      const filaIndice = (typeof filaVisualOverride === 'number' && filaVisualOverride >= 0)
        ? filaVisualOverride
        : nivel;

      // Dimensiones porcentuales fieles al cálculo de ProceduralLevelGenerator.cs
      const espacioColumna = 100 / Math.max(1, totalEnFila);
      const widthPercent = Math.max(18, Math.min(28, espacioColumna * 0.86));
      const heightPercent = Math.max(11, Math.min(15.5, (100 / Math.max(2, totalFilas)) * 0.56));

      let xPercent = 50;
      if (totalEnFila > 1) {
        const margenX = (widthPercent * 0.5) + 2.2;
        const minX = margenX;
        const maxX = 100 - margenX;
        const t = indexEnFila / (totalEnFila - 1);
        xPercent = minX + (maxX - minX) * t;
      }

      const margenY = (heightPercent * 0.5) + 4.5;
      const topY = margenY;
      const bottomY = 100 - margenY;
      const ty = totalFilas > 1 ? (filaIndice / (totalFilas - 1)) : 0.5;
      const yPercent = topY + (bottomY - topY) * ty;

      const node = new EmployeeNode({
        id: 'node_' + LevelManager.nodosActivos.length,
        roleName: nombre.replace(/\n/g, ' '),
        displayTitle: nombre,
        nivel: nivel,
        departamento: depto,
        maxDirectReports: maxReportes,
        isRootNode: esRaiz,
        baseColor: this.obtenerColorArea(depto),
        xPercent: xPercent,
        yPercent: yPercent,
        widthPercent: widthPercent,
        heightPercent: heightPercent
      });

      const nodesLayer = document.getElementById('nodesLayer');
      const cardEl = document.createElement('div');
      cardEl.className = 'employee-node' + (esRaiz ? ' node-root' : '');
      cardEl.id = node.id;
      cardEl.style.left = `${xPercent}%`;
      cardEl.style.top = `${yPercent}%`;
      cardEl.style.width = `${widthPercent}%`;
      cardEl.style.height = `${heightPercent}%`;

      const titleEl = document.createElement('div');
      titleEl.className = 'node-title';

      const spanEl = document.createElement('div');
      spanEl.className = 'node-span-info';

      cardEl.appendChild(titleEl);
      cardEl.appendChild(spanEl);
      nodesLayer.appendChild(cardEl);

      node.el = cardEl;
      node.titleEl = titleEl;
      node.spanEl = spanEl;

      LevelManager.registrarNodo(node, esRaiz);
      node.refreshNodeVisuals();
      BoardInteraction.bindNodeEvents(node);

      return node;
    }
  };

  // ==================== INTERACCIÓN DE NODOS Y LÍNEAS (UINodeInteraction.cs & UILineConnection.cs) ====================
  const BoardInteraction = {
    draggingNode: null,
    selectedNode: null,
    hoveredNode: null,
    pointerPos: { x: 0, y: 0 },
    lastTapTimeByNode: {},

    init() {
      const spawnArea = document.getElementById('spawnArea');
      if (!spawnArea) return;

      window.addEventListener('pointermove', (e) => {
        if (!this.draggingNode) return;
        this.updatePointerFromEvent(e);
        this.updateHoveredTarget(e.clientX, e.clientY);
        this.renderLines();
      });

      window.addEventListener('pointerup', (e) => {
        if (!this.draggingNode) return;
        const startNode = this.draggingNode;
        this.draggingNode.el.classList.remove('node-dragging');
        this.draggingNode = null;

        const targetNode = this.findNodeAtPoint(e.clientX, e.clientY);
        this.clearHoverStyles();

        if (targetNode && targetNode !== startNode) {
          this.handleConnectionAttempt(startNode, targetNode);
          this.resetSelection();
        }
        this.renderLines();
      });

      window.addEventListener('resize', () => this.renderLines());
    },

    renderGuides(totalFilas) {
      const guides = document.getElementById('tierGuides');
      if (!guides) return;
      guides.innerHTML = '';
      const labels = totalFilas === 3
        ? ['Nivel Estratégico (Cúpula)', 'Mandos Directivos', 'Núcleo Operativo']
        : ['Nivel Estratégico (CEO)', 'Nivel Ejecutivo (Directores)', 'Nivel Táctico (Gerentes)', 'Nivel Operativo (Analistas / Base)'];

      labels.forEach((lbl, idx) => {
        const div = document.createElement('div');
        div.className = 'tier-guide-line';
        const ty = labels.length > 1 ? (idx / (labels.length - 1)) : 0.5;
        const yPct = 11 + (78 * ty) - 6.5;
        div.style.top = `${Math.max(1, yPct)}%`;
        div.textContent = lbl;
        guides.appendChild(div);
      });
    },

    bindNodeEvents(node) {
      const el = node.el;
      if (!el) return;

      // Iniciar arrastre (Drag)
      el.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return; // Clic derecho reservado para desconectar
        e.preventDefault();
        FeedbackManager.ensureAudioCtx();

        // Detectar doble toque / doble clic rápido para desconectar
        const now = performance.now();
        const prev = this.lastTapTimeByNode[node.id] || 0;
        if (now - prev < 320) {
          this.lastTapTimeByNode[node.id] = 0;
          this.resetSelection();
          this.tryDisconnectFromManager(node);
          return;
        }
        this.lastTapTimeByNode[node.id] = now;

        this.draggingNode = node;
        el.classList.add('node-dragging');
        this.updatePointerFromEvent(e);
        this.renderLines();
      });

      // Clic simple también permite conectar tocando origen y luego destino (accesibilidad móvil/PC)
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.selectedNode && this.selectedNode !== node) {
          const first = this.selectedNode;
          this.resetSelection();
          this.handleConnectionAttempt(first, node);
        } else if (!this.selectedNode) {
          this.selectedNode = node;
          node.el.classList.add('node-selected');
        } else {
          this.resetSelection();
        }
      });

      // Clic derecho para desconectar
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.resetSelection();
        this.tryDisconnectFromManager(node);
      });
    },

    resetSelection() {
      if (this.selectedNode && this.selectedNode.el) {
        this.selectedNode.el.classList.remove('node-selected');
      }
      this.selectedNode = null;
    },

    clearHoverStyles() {
      if (this.hoveredNode && this.hoveredNode.el) {
        this.hoveredNode.el.classList.remove('node-drop-target');
      }
      this.hoveredNode = null;
    },

    updatePointerFromEvent(e) {
      const spawnArea = document.getElementById('spawnArea');
      if (!spawnArea) return;
      const rect = spawnArea.getBoundingClientRect();
      this.pointerPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    },

    findNodeAtPoint(clientX, clientY) {
      for (const node of LevelManager.nodosActivos) {
        if (!node || !node.el) continue;
        const r = node.el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          return node;
        }
      }
      return null;
    },

    updateHoveredTarget(clientX, clientY) {
      const found = this.findNodeAtPoint(clientX, clientY);
      if (found !== this.hoveredNode) {
        this.clearHoverStyles();
        if (found && found !== this.draggingNode) {
          this.hoveredNode = found;
          found.el.classList.add('node-drop-target');
        }
      }
    },

    tryDisconnectFromManager(node) {
      if (!node || !node.manager) return;

      const tieneSubordinados = node.directReports.length > 0;
      const comodinListo = WildcardManager.comodinActivo;

      if (tieneSubordinados && !comodinListo) {
        FeedbackManager.playErrorFeedback(
          node,
          'Reestructuración bloqueada: este mando ya tiene subordinados a cargo. Activá el Comodín para mover o desconectar toda la rama.'
        );
        return;
      }

      const exJefe = node.manager.roleName;
      node.removeCurrentManager();

      if (tieneSubordinados && comodinListo) {
        WildcardManager.consumirComodin();
      }

      this.renderLines();
      FeedbackManager.playSnapFeedback(node, `Desconectado: ${node.roleName} dejó de reportar a ${exJefe}.`);
    },

    handleConnectionAttempt(nodeA, nodeB) {
      if (!nodeA || !nodeB || nodeA === nodeB) return;

      // Determinamos automáticamente quién es el subordinado y quién es el superior según su nivel jerárquico
      let subordinateNode = nodeA;
      let managerNode = nodeB;

      if (nodeA.nivel < nodeB.nivel) {
        subordinateNode = nodeB;
        managerNode = nodeA;
      }

      const requiereComodin = subordinateNode.directReports.length > 0 && subordinateNode.manager !== null;
      const comodinActivo = WildcardManager.comodinActivo;

      if (requiereComodin && !comodinActivo) {
        FeedbackManager.playErrorFeedback(
          subordinateNode,
          'No podés reasignar una rama con subordinados sin activar el Comodín de Reestructuración.'
        );
        return;
      }

      const result = subordinateNode.tryAssignManager(managerNode);
      if (result.ok) {
        if (subordinateNode.directReports.length > 0 && comodinActivo) {
          WildcardManager.consumirComodin();
        }

        this.renderLines();
        FeedbackManager.playSnapFeedback(
          managerNode,
          `✓ Cadena de mando: ${subordinateNode.roleName} → ${managerNode.roleName} (Tramo: ${managerNode.directReports.length}/${managerNode.maxDirectReports})`
        );

        TutorialManager.notificarConexionExitosa();
        LevelManager.evaluarVictoria();
      } else {
        FeedbackManager.playErrorFeedback(subordinateNode, result.motivo);
      }
    },

    renderLines() {
      const svg = document.getElementById('connectionsSvg');
      const spawnArea = document.getElementById('spawnArea');
      if (!svg || !spawnArea) return;

      const areaRect = spawnArea.getBoundingClientRect();
      const w = areaRect.width || 1;
      const h = areaRect.height || 1;

      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.innerHTML = '';

      // 1. Líneas permanentes entre cada subordinado y su jefe
      for (const node of LevelManager.nodosActivos) {
        if (!node || !node.manager) continue;
        const x1 = (node.manager.xPercent / 100) * w;
        const y1 = (node.manager.yPercent / 100) * h;
        const x2 = (node.xPercent / 100) * w;
        const y2 = (node.yPercent / 100) * h;

        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        glow.setAttribute('x1', String(x1));
        glow.setAttribute('y1', String(y1));
        glow.setAttribute('x2', String(x2));
        glow.setAttribute('y2', String(y2));
        glow.setAttribute('stroke', 'rgba(128, 203, 196, 0.28)');
        glow.setAttribute('stroke-width', '10');
        glow.setAttribute('stroke-linecap', 'round');
        svg.appendChild(glow);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(x2));
        line.setAttribute('y2', String(y2));
        line.setAttribute('stroke', 'rgba(74, 134, 198, 0.96)');
        line.setAttribute('stroke-width', '5');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
      }

      // 2. Línea temporal durante arrastre
      if (this.draggingNode) {
        const x1 = (this.draggingNode.xPercent / 100) * w;
        const y1 = (this.draggingNode.yPercent / 100) * h;
        const x2 = this.pointerPos.x;
        const y2 = this.pointerPos.y;

        const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', String(x1));
        tempLine.setAttribute('y1', String(y1));
        tempLine.setAttribute('x2', String(x2));
        tempLine.setAttribute('y2', String(y2));
        tempLine.setAttribute('stroke', 'rgba(245, 217, 89, 0.88)');
        tempLine.setAttribute('stroke-width', '5');
        tempLine.setAttribute('stroke-dasharray', '8 6');
        tempLine.setAttribute('stroke-linecap', 'round');
        svg.appendChild(tempLine);
      }
    }
  };

  // ==================== LEVEL MANAGER (LevelManager.cs) ====================
  const LevelManager = {
    nodosActivos: [],
    nodoRaiz: null,
    indiceNivelCampana: 0,
    criterioActual: CriterioDepartamentalizacion.Funcional,
    modoAutoridadActual: ModoAutoridad.Equilibrada,
    exigirCadenaEstricta: true,
    nivelYaCompletado: false,
    enModoDiario: false,
    numeroDesafioDiario: 1,

    nivelesCampana: [
      {
        nombreCorto: 'Nivel 1: Cadena y Tramo de Control',
        etiquetaConcepto: 'Fayol • Jerarquía Lineal-Funcional',
        titulo: 'Nivel 1: Cadena de Mando y Tramo de Control',
        subtitulo: 'Departamentalización Funcional | Conectá cada rol respetando su área y cupo',
        resumenVictoria: '<b>Concepto validado: Cadena de Mando y Tramo de Control</b>\n\nEstableciste la línea de autoridad formal desde el Nivel Operativo hasta el Nivel Estratégico (CEO) sin superar la capacidad de supervisión directa de ningún mando.',
        cantidadNodos: 8,
        criterio: CriterioDepartamentalizacion.Funcional,
        autoridad: ModoAutoridad.Equilibrada,
        semillaBase: 10101
      },
      {
        nombreCorto: 'Nivel 2: Departamentalización por Producto',
        etiquetaConcepto: 'Estructura Divisional • Unidades de Negocio',
        titulo: 'Nivel 2: Departamentalización por Producto',
        subtitulo: 'Agrupamiento por División (PyMEs, Consumo, Industria) | Unidad de Mando',
        resumenVictoria: '<b>Concepto validado: Departamentalización por Producto</b>\n\nAgrupaste los roles según la línea de producto/servicio que atienden, facilitando la coordinación autónoma de cada unidad de negocio.',
        cantidadNodos: 9,
        criterio: CriterioDepartamentalizacion.PorProducto,
        autoridad: ModoAutoridad.Equilibrada,
        semillaBase: 20202
      },
      {
        nombreCorto: 'Nivel 3: Departamentalización Geográfica',
        etiquetaConcepto: 'Cobertura Territorial • Regiones Operativas',
        titulo: 'Nivel 3: Departamentalización Geográfica',
        subtitulo: 'Agrupamiento Territorial (Norte, Centro, Sur) | Gestión regional',
        resumenVictoria: '<b>Concepto validado: Departamentalización Geográfica</b>\n\nOrganizaste las operaciones por zonas territoriales para responder con agilidad a las demandas de cada región.',
        cantidadNodos: 10,
        criterio: CriterioDepartamentalizacion.Geografica,
        autoridad: ModoAutoridad.Equilibrada,
        semillaBase: 30303
      },
      {
        nombreCorto: 'Nivel 4: Estructura Centralizada (Chata)',
        etiquetaConcepto: 'Tramo Amplio • Supervisión Directa',
        titulo: 'Nivel 4: Estructura Centralizada (Chata)',
        subtitulo: 'Tramo de control amplio en la cúpula | Menos niveles intermedios',
        resumenVictoria: '<b>Concepto validado: Centralización y Estructura Chata</b>\n\nCon un tramo de control amplio y menos eslabones intermedios, la Dirección retiene la supervisión cercana, acortando la cadena jerárquica.',
        cantidadNodos: 8,
        criterio: CriterioDepartamentalizacion.Funcional,
        autoridad: ModoAutoridad.Centralizada,
        semillaBase: 40404
      },
      {
        nombreCorto: 'Nivel 5: Estructura Descentralizada (Vertical)',
        etiquetaConcepto: 'Tramo Estrecho • Delegación Táctica',
        titulo: 'Nivel 5: Estructura Descentralizada (Vertical)',
        subtitulo: 'Tramo de control estrecho | Delegación obligatoria en mandos medios',
        resumenVictoria: '<b>Concepto validado: Descentralización y Delegación</b>\n\nCon tramos de control ajustados, el CEO delega la autoridad táctica en Directores y Gerentes sin generar cuellos de botella en la cima estratégica.',
        cantidadNodos: 11,
        criterio: CriterioDepartamentalizacion.Funcional,
        autoridad: ModoAutoridad.Descentralizada,
        semillaBase: 50505
      }
    ],

    iniciarJuego() {
      FeedbackManager.init();
      DailyStreakManager.loadStreakData();
      WildcardManager.init();
      TutorialManager.init();
      BoardInteraction.init();

      this.vincularBotonesNavegacion();
      TutorialManager.ocultarPanelInmediato();
      this.cargarNivelActual();
      this.mostrarMenuPrincipal();
    },

    vincularBotonesNavegacion() {
      const btnAbrirMenu = document.getElementById('botonAbrirMenu');
      if (btnAbrirMenu) btnAbrirMenu.addEventListener('click', () => this.mostrarMenuPrincipal());

      const btnReiniciar = document.getElementById('botonReiniciarNivel');
      if (btnReiniciar) btnReiniciar.addEventListener('click', () => this.reiniciarNivelActual());

      const btnSound = document.getElementById('btnToggleSound');
      if (btnSound) btnSound.addEventListener('click', () => FeedbackManager.toggleMute());

      const btnPlayCampaign = document.getElementById('btnPlayCampaign');
      if (btnPlayCampaign) {
        btnPlayCampaign.addEventListener('click', () => {
          const idx = this.indiceNivelCampana < this.nivelesCampana.length ? this.indiceNivelCampana : 0;
          this.iniciarNivelCampanaDesdeMenu(idx);
        });
      }

      const btnOpenSelector = document.getElementById('btnOpenLevelSelector');
      if (btnOpenSelector) {
        btnOpenSelector.addEventListener('click', () => this.cambiarSubvistaMenu('selector'));
      }

      const btnDaily = document.getElementById('btnDailyChallenge');
      if (btnDaily) {
        btnDaily.addEventListener('click', () => this.iniciarDesafioDiarioDesdeMenu());
      }

      const btnGlossary = document.getElementById('btnGlossary');
      if (btnGlossary) {
        btnGlossary.addEventListener('click', () => this.cambiarSubvistaMenu('glossary'));
      }

      const btnBackSelector = document.getElementById('btnBackFromSelector');
      if (btnBackSelector) {
        btnBackSelector.addEventListener('click', () => this.cambiarSubvistaMenu('home'));
      }

      const btnBackGlossary = document.getElementById('btnBackFromGlossary');
      if (btnBackGlossary) {
        btnBackGlossary.addEventListener('click', () => this.cambiarSubvistaMenu('home'));
      }

      // Selector de los 5 niveles
      document.querySelectorAll('[data-level-index]').forEach((btnLvl) => {
        btnLvl.addEventListener('click', () => {
          const idx = parseInt(btnLvl.getAttribute('data-level-index') || '0', 10);
          this.iniciarNivelCampanaDesdeMenu(idx);
        });
      });
    },

    limpiarNodosRegistrados() {
      this.nodosActivos = [];
      this.nodoRaiz = null;
      this.nivelYaCompletado = false;
    },

    registrarNodo(nodo, esRaiz) {
      if (!nodo) return;
      if (!this.nodosActivos.includes(nodo)) {
        this.nodosActivos.push(nodo);
      }
      if (esRaiz) this.nodoRaiz = nodo;
    },

    existeNivelIntermedioParaArea(nivelSubordinado, depto) {
      const nivelInmediatoSuperior = nivelSubordinado - 1;
      return this.nodosActivos.some(
        n => n && n.nivel === nivelInmediatoSuperior && (n.departamento === depto || n.departamento === Departamento.General)
      );
    },

    obtenerNombreDepartamento(depto) {
      return ProceduralLevelGenerator.obtenerEtiquetaCriterio(depto, this.criterioActual);
    },

    mostrarMenuPrincipal() {
      const overlay = document.getElementById('mainMenuOverlay');
      if (overlay) overlay.classList.remove('hidden');
      this.cambiarSubvistaMenu('home');
      StreakUI.actualizarPantalla();
    },

    ocultarMenuPrincipal() {
      const overlay = document.getElementById('mainMenuOverlay');
      if (overlay) overlay.classList.add('hidden');
    },

    cambiarSubvistaMenu(vista) {
      const home = document.getElementById('homeView');
      const selector = document.getElementById('levelSelectorView');
      const glossary = document.getElementById('glossaryView');

      if (home) home.classList.toggle('hidden', vista !== 'home');
      if (selector) selector.classList.toggle('hidden', vista !== 'selector');
      if (glossary) glossary.classList.toggle('hidden', vista !== 'glossary');
    },

    iniciarNivelCampanaDesdeMenu(indice) {
      this.enModoDiario = false;
      this.indiceNivelCampana = Math.max(0, Math.min(this.nivelesCampana.length - 1, indice));
      this.ocultarMenuPrincipal();
      this.cargarNivelActual();

      if (this.indiceNivelCampana === 0) {
        TutorialManager.iniciarTutorial();
      }
    },

    iniciarDesafioDiarioDesdeMenu() {
      this.enModoDiario = true;
      this.ocultarMenuPrincipal();
      this.cargarNivelActual();

      const seed = ProceduralLevelGenerator.obtenerSemillaDiaria();
      FeedbackManager.mostrarMensajeEstado(
        `📅 Puzzle Diario iniciado (Semilla #${seed}). ¡Armá el organigrama para sumar a tu racha!`,
        'rgba(36, 92, 138, 0.95)',
        3.2
      );
    },

    cargarNivelActual() {
      if (!this.enModoDiario && this.indiceNivelCampana < this.nivelesCampana.length) {
        const cfg = this.nivelesCampana[this.indiceNivelCampana];
        this.criterioActual = cfg.criterio;
        this.modoAutoridadActual = cfg.autoridad;
        this.exigirCadenaEstricta = true;

        this.actualizarCabeceraUI(cfg.titulo, cfg.subtitulo);
        ProceduralLevelGenerator.generarNivelAcademico(cfg.semillaBase, cfg.cantidadNodos, cfg.criterio, cfg.autoridad);
      } else {
        this.enModoDiario = true;
        const seed = ProceduralLevelGenerator.obtenerSemillaDiaria() + ((this.numeroDesafioDiario - 1) * 37);
        const criterios = [
          CriterioDepartamentalizacion.Funcional,
          CriterioDepartamentalizacion.PorProducto,
          CriterioDepartamentalizacion.Geografica,
          CriterioDepartamentalizacion.Matricial
        ];
        this.criterioActual = criterios[(seed + this.numeroDesafioDiario) % criterios.length];
        this.modoAutoridadActual = (this.numeroDesafioDiario % 3 === 0)
          ? ModoAutoridad.Descentralizada
          : ((this.numeroDesafioDiario % 2 === 0) ? ModoAutoridad.Centralizada : ModoAutoridad.Equilibrada);
        this.exigirCadenaEstricta = true;

        this.actualizarCabeceraUI(
          `📅 Desafío Diario #${this.numeroDesafioDiario}: Criterio ${this.criterioActual}`,
          `Autoridad ${this.modoAutoridadActual} | Semilla #${seed} | Doble toque para desconectar`
        );
        ProceduralLevelGenerator.generarNivelAcademico(seed, 10, this.criterioActual, this.modoAutoridadActual);
      }
      BoardInteraction.renderLines();
    },

    avanzarSiguienteNivel() {
      if (this.enModoDiario) {
        this.numeroDesafioDiario++;
      } else {
        this.indiceNivelCampana++;
        if (this.indiceNivelCampana >= this.nivelesCampana.length) {
          this.enModoDiario = true;
          this.numeroDesafioDiario = 1;
        }
      }

      if (this.indiceNivelCampana % 2 === 0 || this.enModoDiario) {
        WildcardManager.recompensarComodin(1);
      }

      this.cargarNivelActual();
    },

    reiniciarNivelActual() {
      this.cargarNivelActual();
      FeedbackManager.mostrarMensajeEstado('↻ Tablero reiniciado.', 'rgba(56, 71, 97, 0.94)', 1.6);
    },

    evaluarVictoria() {
      if (this.nivelYaCompletado) return;
      if (OrgValidator.validateWinCondition(this.nodosActivos, this.nodoRaiz)) {
        this.nivelYaCompletado = true;
        this.ejecutarFeedbackVictoria();
      }
    },

    ejecutarFeedbackVictoria() {
      FeedbackManager.playVictoryFeedback(this.nodosActivos);
      DailyStreakManager.registerWin();
      StreakUI.actualizarPantalla();

      setTimeout(() => {
        const resumen = (!this.enModoDiario && this.indiceNivelCampana < this.nivelesCampana.length)
          ? this.nivelesCampana[this.indiceNivelCampana].resumenVictoria
          : `<b>¡Desafío Diario #${this.numeroDesafioDiario} Completado!</b>\n\nResolviste correctamente el organigrama bajo departamentalización <b>${this.criterioActual}</b> y autoridad <b>${this.modoAutoridadActual}</b>.`;
        TutorialManager.mostrarPantallaNivelCompletado(resumen);
      }, 850);
    },

    actualizarCabeceraUI(titulo, subtitulo) {
      const t = document.getElementById('headerTitle');
      const s = document.getElementById('headerSubtitle');
      if (t) t.textContent = titulo;
      if (s) s.textContent = subtitulo;
    }
  };

  window.addEventListener('DOMContentLoaded', () => {
    LevelManager.iniciarJuego();
  });
})();
