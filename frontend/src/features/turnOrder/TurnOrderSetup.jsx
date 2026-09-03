import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as gamesApi from '../games/games.api';
import { Loader2, GripVertical, CheckCircle, Shield } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, name, isCreator }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-4 bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-lg mb-3"
    >
      <div 
        {...attributes} 
        {...listeners} 
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-800 rounded text-slate-500"
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <div className="flex-1 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-200">{name}</span>
          {isCreator && <Shield className="w-4 h-4 text-emerald-500" />}
        </div>
      </div>
    </div>
  );
};

const TurnOrderSetup = () => {
  const { id: gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameData = await gamesApi.getGameById(gameId);
        setGame(gameData);
        // Map participants to just the user objects
        setParticipants(gameData.participants.map(p => p.userId));
      } catch (err) {
        console.error(err);
        setError('Failed to load game');
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setParticipants((items) => {
        const oldIndex = items.findIndex((i) => i._id === active.id);
        const newIndex = items.findIndex((i) => i._id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      const orderedIds = participants.map(p => p._id);
      await gamesApi.setTurnOrder(gameId, orderedIds);
      await gamesApi.startGame(gameId);
      navigate(`/games/${gameId}/board`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start game');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Set Turn Order</h1>
          <p className="text-slate-400">Drag and drop to arrange the players.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={participants.map(p => p._id)}
              strategy={verticalListSortingStrategy}
            >
              {participants.map((p, index) => (
                <div key={p._id} className="relative">
                  <div className="absolute -left-12 top-4 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-sm font-bold text-slate-400">
                    {index + 1}
                  </div>
                  <SortableItem 
                    id={p._id} 
                    name={p.name} 
                    isCreator={game.createdBy?._id === p._id} 
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          <button
            onClick={handleConfirm}
            disabled={saving}
            className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex justify-center items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>Confirm & Start Game <CheckCircle className="w-5 h-5" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TurnOrderSetup;
