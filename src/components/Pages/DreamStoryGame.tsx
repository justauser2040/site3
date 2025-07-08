import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Save, Upload, Volume2, VolumeX, Home, Utensils, Dumbbell, Droplets, Bath, Bed, Clock, Heart, Zap, Brain, Moon, Sun, Star, Gamepad2 } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface DreamStoryGameProps {
  onBack: () => void;
}

interface GameState {
  time: number; // em minutos (0-1440 = 24 horas)
  energy: number; // 0-100
  hunger: number; // 0-100
  hygiene: number; // 0-100
  happiness: number; // 0-100
  sleepiness: number; // 0-100
  health: number; // 0-100
  currentRoom: 'bedroom' | 'living' | 'kitchen' | 'gym' | 'bathroom';
  currentAction: string | null;
  actionTimeLeft: number;
  day: number;
  gameSpeed: number;
  lastSaveTime: number;
}

interface Activity {
  id: string;
  name: string;
  duration: number; // em minutos do jogo
  effects: {
    energy?: number;
    hunger?: number;
    hygiene?: number;
    happiness?: number;
    sleepiness?: number;
    health?: number;
  };
  room: string;
  icon: React.ComponentType<any>;
  available: (state: GameState) => boolean;
}

const DreamStoryGame: React.FC<DreamStoryGameProps> = ({ onBack }) => {
  const { isDark } = useTheme();
  const [gameState, setGameState] = useState<GameState>({
    time: 420, // 7:00 AM
    energy: 80,
    hunger: 30,
    hygiene: 90,
    happiness: 70,
    sleepiness: 20,
    health: 85,
    currentRoom: 'bedroom',
    currentAction: null,
    actionTimeLeft: 0,
    day: 1,
    gameSpeed: 1,
    lastSaveTime: Date.now()
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [gameStyle, setGameStyle] = useState<'2d' | 'isometric'>('2d');
  const [showWelcome, setShowWelcome] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gameLoopRef = useRef<NodeJS.Timeout>();

  const activities: Activity[] = [
    {
      id: 'sleep',
      name: 'Dormir',
      duration: 480, // 8 horas
      effects: { energy: 100, sleepiness: -100, health: 10 },
      room: 'bedroom',
      icon: Bed,
      available: (state) => state.sleepiness > 60 || state.time > 1320 || state.time < 360
    },
    {
      id: 'computer',
      name: 'Usar Computador',
      duration: 120, // 2 horas
      effects: { happiness: 15, energy: -10, sleepiness: 5 },
      room: 'bedroom',
      icon: Brain,
      available: () => true
    },
    {
      id: 'relax',
      name: 'Relaxar no Sofá',
      duration: 60, // 1 hora
      effects: { happiness: 10, energy: 5, sleepiness: 10 },
      room: 'living',
      icon: Heart,
      available: () => true
    },
    {
      id: 'tv',
      name: 'Assistir TV',
      duration: 90, // 1.5 horas
      effects: { happiness: 20, sleepiness: 15 },
      room: 'living',
      icon: Play,
      available: () => true
    },
    {
      id: 'eat',
      name: 'Comer',
      duration: 30, // 30 minutos
      effects: { hunger: -50, happiness: 10, energy: 15 },
      room: 'kitchen',
      icon: Utensils,
      available: (state) => state.hunger > 20
    },
    {
      id: 'drinkWater',
      name: 'Beber Água',
      duration: 5, // 5 minutos
      effects: { health: 5, energy: 5 },
      room: 'kitchen',
      icon: Droplets,
      available: () => true
    },
    {
      id: 'exercise',
      name: 'Exercitar-se',
      duration: 60, // 1 hora
      effects: { health: 15, energy: -20, hunger: 15, happiness: 10, sleepiness: -10 },
      room: 'gym',
      icon: Dumbbell,
      available: (state) => state.energy > 30
    },
    {
      id: 'shower',
      name: 'Tomar Banho',
      duration: 20, // 20 minutos
      effects: { hygiene: 50, happiness: 10, energy: 5 },
      room: 'bathroom',
      icon: Bath,
      available: (state) => state.hygiene < 80
    }
  ];

  // Verificar se é um novo jogo (sem save)
  const isNewGame = () => {
    const savedGame = localStorage.getItem('dream-story-save');
    return !savedGame;
  };

  // Inicializar o jogo
  useEffect(() => {
    // Mostrar boas-vindas apenas para novos jogos
    if (isNewGame()) {
      setShowWelcome(true);
    }

    // Configurar áudio
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.loop = true;
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, []);

  // Game loop - pausar durante boas-vindas
  useEffect(() => {
    if (isPaused || showWelcome) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      return;
    }

    gameLoopRef.current = setInterval(() => {
      setGameState(prevState => {
        const newState = { ...prevState };
        
        // Avançar tempo (1 segundo real = 15 minutos do jogo)
        newState.time += 15 * newState.gameSpeed;
        
        // Novo dia
        if (newState.time >= 1440) {
          newState.time = 0;
          newState.day += 1;
        }
        
        // Reduzir tempo de ação
        if (newState.actionTimeLeft > 0) {
          newState.actionTimeLeft -= 15 * newState.gameSpeed;
          if (newState.actionTimeLeft <= 0) {
            newState.currentAction = null;
            newState.actionTimeLeft = 0;
          }
        }
        
        // Degradação natural das necessidades (a cada 15 minutos do jogo)
        newState.energy = Math.max(0, newState.energy - 0.5);
        newState.hunger = Math.min(100, newState.hunger + 0.8);
        newState.hygiene = Math.max(0, newState.hygiene - 0.3);
        newState.sleepiness = Math.min(100, newState.sleepiness + 0.6);
        
        // Calcular saúde baseada nas outras necessidades
        const avgNeeds = (
          (100 - newState.hunger) + 
          newState.energy + 
          newState.hygiene + 
          newState.happiness + 
          (100 - newState.sleepiness)
        ) / 5;
        newState.health = Math.max(0, Math.min(100, avgNeeds));
        
        return newState;
      });
    }, 1000);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [isPaused, showWelcome]);

  // Função para iniciar o jogo após boas-vindas
  const handleStartGame = () => {
    setShowWelcome(false);
    if (audioRef.current && !isMuted) {
      audioRef.current.play().catch(console.error);
    }
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getTimeOfDay = (minutes: number): string => {
    if (minutes >= 360 && minutes < 720) return 'Manhã';
    if (minutes >= 720 && minutes < 1080) return 'Tarde';
    if (minutes >= 1080 && minutes < 1320) return 'Noite';
    return 'Madrugada';
  };

  const getTimeIcon = (minutes: number) => {
    if (minutes >= 360 && minutes < 720) return Sun;
    if (minutes >= 720 && minutes < 1080) return Sun;
    if (minutes >= 1080 && minutes < 1320) return Moon;
    return Star;
  };

  const performActivity = (activity: Activity) => {
    if (gameState.currentAction || !activity.available(gameState)) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      newState.currentAction = activity.name;
      newState.actionTimeLeft = activity.duration;
      newState.currentRoom = activity.room as any;

      // Aplicar efeitos da atividade
      Object.entries(activity.effects).forEach(([key, value]) => {
        if (key in newState && typeof value === 'number') {
          (newState as any)[key] = Math.max(0, Math.min(100, (newState as any)[key] + value));
        }
      });

      return newState;
    });
  };

  const saveGame = () => {
    const saveData = { ...gameState, lastSaveTime: Date.now() };
    localStorage.setItem('dream-story-save', JSON.stringify(saveData));
    alert('Jogo salvo com sucesso!');
  };

  const loadGame = () => {
    const savedGame = localStorage.getItem('dream-story-save');
    if (savedGame) {
      try {
        const parsed = JSON.parse(savedGame);
        setGameState(parsed);
        setShowWelcome(false); // Não mostrar boas-vindas ao carregar
        alert('Jogo carregado com sucesso!');
      } catch (error) {
        alert('Erro ao carregar o jogo!');
      }
    } else {
      alert('Nenhum jogo salvo encontrado!');
    }
  };

  const resetGame = () => {
    if (confirm('Tem certeza que deseja reiniciar o jogo? Todo o progresso será perdido.')) {
      localStorage.removeItem('dream-story-save');
      setGameState({
        time: 420,
        energy: 80,
        hunger: 30,
        hygiene: 90,
        happiness: 70,
        sleepiness: 20,
        health: 85,
        currentRoom: 'bedroom',
        currentAction: null,
        actionTimeLeft: 0,
        day: 1,
        gameSpeed: 1,
        lastSaveTime: Date.now()
      });
      setShowWelcome(true); // Mostrar boas-vindas ao reiniciar
      setIsPaused(false);
    }
  };

  const toggleMusic = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  };

  const changeRoom = (room: typeof gameState.currentRoom) => {
    if (gameState.currentAction) return;
    setGameState(prev => ({ ...prev, currentRoom: room }));
  };

  const getStatColor = (value: number, inverse = false): string => {
    if (inverse) value = 100 - value;
    if (value >= 70) return 'text-green-400';
    if (value >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatBgColor = (value: number, inverse = false): string => {
    if (inverse) value = 100 - value;
    if (value >= 70) return 'bg-green-500';
    if (value >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const TimeIcon = getTimeIcon(gameState.time);

  const roomActivities = activities.filter(activity => activity.room === gameState.currentRoom);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950' 
        : 'bg-gradient-to-br from-white via-emerald-50/80 to-emerald-100/60'
    }`}>
      {/* Audio */}
      <audio
        ref={audioRef}
        src="/[KAIROSOFT SOUNDTRACKS] Game Dev Story Working Hard (1) (2).mp3"
        loop
        muted={isMuted}
      />

      {/* Painel de Boas-Vindas */}
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`max-w-md w-full mx-4 rounded-2xl p-8 border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/95 border-slate-800' 
              : 'bg-white/95 border-emerald-200 shadow-xl'
          }`}>
            <div className="text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Gamepad2 className="w-10 h-10 text-emerald-400" />
              </div>
              
              <h2 className={`text-2xl font-bold mb-4 transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-emerald-900'
              }`}>
                Bem-vindo ao Dream Story!
              </h2>
              
              <p className={`text-base leading-relaxed mb-4 transition-colors duration-300 ${
                isDark ? 'text-slate-300' : 'text-emerald-800'
              }`}>
                Aqui você vai guiar Alex em uma jornada para buscar o melhor sono e saúde!
              </p>
              
              <p className={`text-base leading-relaxed mb-8 transition-colors duration-300 ${
                isDark ? 'text-slate-300' : 'text-emerald-800'
              }`}>
                Faça boas escolhas e boa sorte!
              </p>
              
              <button
                onClick={handleStartGame}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
              >
                <Play className="w-5 h-5" />
                Vamos lá!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-sm border-b transition-colors duration-300 ${
        isDark 
          ? 'bg-slate-900/95 border-slate-800' 
          : 'bg-white/95 border-gray-200'
      }`}>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className={`p-2 rounded-full transition-colors ${
                  isDark 
                    ? 'hover:bg-slate-800 text-white' 
                    : 'hover:bg-gray-100 text-gray-900'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className={`text-lg font-bold transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Dream Story</h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                disabled={showWelcome}
                className={`p-2 rounded-lg transition-colors ${
                  showWelcome 
                    ? 'opacity-50 cursor-not-allowed'
                    : isDark 
                      ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              
              <button
                onClick={toggleMusic}
                className={`p-2 rounded-lg transition-colors ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Game Controls */}
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <TimeIcon className="w-5 h-5 text-emerald-400" />
              <span className={`font-bold transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Dia {gameState.day} - {formatTime(gameState.time)}
              </span>
              <span className={`text-sm transition-colors duration-300 ${
                isDark ? 'text-slate-400' : 'text-gray-600'
              }`}>
                ({getTimeOfDay(gameState.time)})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={saveGame}
              disabled={showWelcome}
              className={`p-2 rounded-lg transition-colors ${
                showWelcome 
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Save className="w-4 h-4" />
            </button>
            
            <button
              onClick={loadGame}
              disabled={showWelcome}
              className={`p-2 rounded-lg transition-colors ${
                showWelcome 
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
              }`}
            >
              <Upload className="w-4 h-4" />
            </button>
            
            <button
              onClick={resetGame}
              disabled={showWelcome}
              className={`p-2 rounded-lg transition-colors ${
                showWelcome 
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark 
                    ? 'bg-red-800 hover:bg-red-700 text-white' 
                    : 'bg-red-200 hover:bg-red-300 text-red-900'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Action */}
        {gameState.currentAction && (
          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-emerald-500/20 border-emerald-500/30' 
              : 'bg-emerald-100/80 border-emerald-300/50'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-emerald-900'
              }`}>
                {gameState.currentAction}
              </span>
              <span className={`text-sm transition-colors duration-300 ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}>
                {Math.ceil(gameState.actionTimeLeft)} min restantes
              </span>
            </div>
            <div className={`mt-2 rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-emerald-200'
            }`}>
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.max(0, 100 - (gameState.actionTimeLeft / 480) * 100)}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats Panel */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className={`w-4 h-4 ${getStatColor(gameState.energy)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Energia</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.energy)}`}
                style={{ width: `${gameState.energy}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.energy)}`}>
              {Math.round(gameState.energy)}%
            </span>
          </div>

          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Utensils className={`w-4 h-4 ${getStatColor(gameState.hunger, true)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Fome</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.hunger, true)}`}
                style={{ width: `${100 - gameState.hunger}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.hunger, true)}`}>
              {Math.round(100 - gameState.hunger)}%
            </span>
          </div>

          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Droplets className={`w-4 h-4 ${getStatColor(gameState.hygiene)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Higiene</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.hygiene)}`}
                style={{ width: `${gameState.hygiene}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.hygiene)}`}>
              {Math.round(gameState.hygiene)}%
            </span>
          </div>

          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className={`w-4 h-4 ${getStatColor(gameState.happiness)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Felicidade</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.happiness)}`}
                style={{ width: `${gameState.happiness}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.happiness)}`}>
              {Math.round(gameState.happiness)}%
            </span>
          </div>

          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Moon className={`w-4 h-4 ${getStatColor(gameState.sleepiness, true)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Sono</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.sleepiness, true)}`}
                style={{ width: `${100 - gameState.sleepiness}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.sleepiness, true)}`}>
              {Math.round(100 - gameState.sleepiness)}%
            </span>
          </div>

          <div className={`p-3 rounded-lg border transition-colors duration-300 ${
            isDark 
              ? 'bg-slate-900/50 border-slate-800' 
              : 'bg-white/80 border-gray-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Heart className={`w-4 h-4 ${getStatColor(gameState.health)}`} />
              <span className={`text-sm font-medium transition-colors duration-300 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>Saúde</span>
            </div>
            <div className={`rounded-full h-2 transition-colors duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-200'
            }`}>
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatBgColor(gameState.health)}`}
                style={{ width: `${gameState.health}%` }}
              />
            </div>
            <span className={`text-xs ${getStatColor(gameState.health)}`}>
              {Math.round(gameState.health)}%
            </span>
          </div>
        </div>
      </div>

      {/* Room Navigation */}
      <div className="px-4 py-4 border-t border-slate-800">
        <h3 className={`text-lg font-bold mb-3 transition-colors duration-300 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>Cômodos</h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            { id: 'bedroom', name: 'Quarto', icon: Bed },
            { id: 'living', name: 'Sala', icon: Home },
            { id: 'kitchen', name: 'Cozinha', icon: Utensils },
            { id: 'gym', name: 'Academia', icon: Dumbbell },
            { id: 'bathroom', name: 'Banheiro', icon: Bath }
          ].map(room => (
            <button
              key={room.id}
              onClick={() => changeRoom(room.id as any)}
              disabled={!!gameState.currentAction || showWelcome}
              className={`p-3 rounded-lg border transition-all duration-200 ${
                gameState.currentRoom === room.id
                  ? 'bg-emerald-500/20 border-emerald-500/50'
                  : gameState.currentAction || showWelcome
                    ? 'opacity-50 cursor-not-allowed'
                    : isDark
                      ? 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/50'
                      : 'bg-white/80 border-gray-200 hover:bg-gray-100/50'
              }`}
            >
              <room.icon className={`w-5 h-5 mx-auto mb-1 ${
                gameState.currentRoom === room.id ? 'text-emerald-400' : isDark ? 'text-slate-400' : 'text-gray-600'
              }`} />
              <span className={`text-xs font-medium block ${
                gameState.currentRoom === room.id 
                  ? 'text-emerald-400' 
                  : isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {room.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Game Area */}
      <div className="px-4 py-4">
        <div className={`rounded-2xl overflow-hidden border transition-colors duration-300 ${
          isDark 
            ? 'bg-slate-900/50 border-slate-800' 
            : 'bg-white/80 border-gray-200'
        }`}>
          {/* Game View */}
          <div className={`pixel-game-container h-64 relative ${gameStyle === '2d' ? 'pixel-room' : 'isometric-container'}`}>
            <div className={`${gameStyle === '2d' ? 'pixel-room-bg' : 'isometric-room'} room-${gameState.currentRoom}`}>
              {/* Character */}
              <div className={`${gameStyle === '2d' ? 'pixel-character' : 'isometric-character'}`}>
                <div className={`${gameStyle === '2d' ? 'alex-sprite-2d' : 'alex-sprite-isometric'} ${
                  gameState.currentAction ? `alex-${gameState.currentAction.toLowerCase().replace(/\s+/g, '')}` : 'alex-idle-2d'
                }`} />
                <div className={`${gameStyle === '2d' ? 'character-shadow-2d' : 'character-shadow'}`} />
              </div>

              {/* Room Objects */}
              {roomActivities.map(activity => (
                <div
                  key={activity.id}
                  className={`${gameStyle === '2d' ? 'pixel-object' : 'isometric-object'} pixel-${activity.id} ${
                    activity.available(gameState) && !gameState.currentAction ? 'available' : 'used'
                  }`}
                  onClick={() => performActivity(activity)}
                  style={{ cursor: activity.available(gameState) && !gameState.currentAction ? 'pointer' : 'not-allowed' }}
                >
                  {gameState.currentAction === activity.name && (
                    <div className={`${gameStyle === '2d' ? 'pixel-completion' : 'isometric-completion'}`}>
                      ⏳
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activities Panel */}
          <div className="p-4 border-t border-slate-800">
            <h4 className={`text-lg font-bold mb-3 transition-colors duration-300 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Atividades Disponíveis
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {roomActivities.map(activity => (
                <button
                  key={activity.id}
                  onClick={() => performActivity(activity)}
                  disabled={!activity.available(gameState) || !!gameState.currentAction || showWelcome}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                    activity.available(gameState) && !gameState.currentAction && !showWelcome
                      ? isDark
                        ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900'
                      : 'opacity-50 cursor-not-allowed border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <activity.icon className="w-4 h-4" />
                    <span className="font-medium">{activity.name}</span>
                  </div>
                  <div className={`text-xs transition-colors duration-300 ${
                    isDark ? 'text-slate-400' : 'text-gray-600'
                  }`}>
                    {activity.duration} min
                  </div>
                  <div className={`text-xs mt-1 transition-colors duration-300 ${
                    isDark ? 'text-slate-500' : 'text-gray-500'
                  }`}>
                    {Object.entries(activity.effects).map(([key, value]) => (
                      <span key={key} className={value! > 0 ? 'text-green-400' : 'text-red-400'}>
                        {key}: {value! > 0 ? '+' : ''}{value} 
                      </span>
                    )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ', ', curr], [] as any)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DreamStoryGame;