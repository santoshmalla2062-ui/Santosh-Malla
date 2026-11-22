import React, { useState } from 'react';
import { 
  Sparkles, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  User, 
  Plus, 
  ArrowRight, 
  ShieldCheck, 
  Wrench, 
  RotateCcw, 
  Bed, 
  Search, 
  Check,
  X 
} from 'lucide-react';
import { 
  HousekeepingTask, 
  ResortRoom, 
  ResortRoomStatus, 
  Session, 
  StaffUser 
} from '../../types';
import { Language } from '../../utils/translations';
import { formatLocalYMD } from '../../services/resortSecurity';

interface HousekeepingBoardProps {
  rooms: ResortRoom[];
  tasks: HousekeepingTask[];
  staffUsers: StaffUser[];
  currentSession: Session | null;
  lang: Language;
  onUpdateRoomStatus: (roomId: string, newStatus: ResortRoomStatus, housekeeperName?: string) => void;
  onUpdateTask: (task: HousekeepingTask) => void;
  onAddTask: (task: Omit<HousekeepingTask, 'id'>) => void;
  onOpenMaintenanceModal: (roomId: string, roomNumber: string) => void;
}

export const HousekeepingBoard: React.FC<HousekeepingBoardProps> = ({
  rooms,
  tasks,
  staffUsers,
  currentSession,
  lang,
  onUpdateRoomStatus,
  onUpdateTask,
  onAddTask,
  onOpenMaintenanceModal
}) => {
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskRoomId, setNewTaskRoomId] = useState(rooms[0]?.id || '');
  const [newTaskType, setNewTaskType] = useState<HousekeepingTask['taskType']>('clean_room');
  const [newTaskStaff, setNewTaskStaff] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<HousekeepingTask['priority']>('normal');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  const floors = Array.from(new Set(rooms.map(r => r.floor)));
  const housekeepingStaff = staffUsers.filter(s => s.role === 'HOUSEKEEPING' || s.role === 'ADMIN' || s.role === 'MANAGER');

  const filteredRooms = rooms.filter(r => {
    if (filterFloor !== 'all' && r.floor !== filterFloor) return false;
    return true;
  });

  const dirtyRooms = filteredRooms.filter(r => r.status === 'DIRTY');
  const cleaningRooms = filteredRooms.filter(r => r.status === 'CLEANING');
  const cleanRooms = filteredRooms.filter(r => r.status === 'CLEAN');
  const availableRooms = filteredRooms.filter(r => r.status === 'AVAILABLE');
  const occupiedRooms = filteredRooms.filter(r => r.status === 'OCCUPIED');

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    const room = rooms.find(r => r.id === newTaskRoomId);
    if (!room) return;

    const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;
    onAddTask({
      roomId: room.id,
      roomNumber: room.roomNumber,
      taskType: newTaskType,
      assignedStaffName: newTaskStaff || undefined,
      priority: newTaskPriority,
      createdTime: nowStr,
      completedTime: null,
      notes: newTaskNotes.trim() || undefined,
      status: 'pending'
    });

    setShowNewTaskModal(false);
    setNewTaskNotes('');
  };

  const handleTaskStatusChange = (task: HousekeepingTask, newStatus: HousekeepingTask['status']) => {
    const nowStr = `${formatLocalYMD()} ${new Date().toTimeString().substring(0, 5)}`;
    const updated: HousekeepingTask = {
      ...task,
      status: newStatus,
      completedTime: newStatus === 'completed' || newStatus === 'inspected' 
        ? nowStr 
        : null
    };
    onUpdateTask(updated);

    // If inspected, also set room status to AVAILABLE
    if (newStatus === 'inspected') {
      onUpdateRoomStatus(task.roomId, 'AVAILABLE', task.assignedStaffName);
    } else if (newStatus === 'in_progress') {
      onUpdateRoomStatus(task.roomId, 'CLEANING', task.assignedStaffName);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-800" />
            {lang === 'ne' ? 'हाउसकिपिङ तथा कोठा सरसफाइ बोर्ड' : 'Housekeeping & Room Turnaround Board'}
          </h2>
          <p className="text-xs text-slate-500">
            Real-time cleanliness tracking, turnaround tasks, and sanitation inspection
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterFloor}
            onChange={(e) => setFilterFloor(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Floors</option>
            {floors.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>

          <button
            onClick={() => setShowNewTaskModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Assign Cleaning Task
          </button>
        </div>
      </div>

      {/* Status Columns: Dirty -> Cleaning -> Ready / Inspected */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: DIRTY / TURNAROUND NEEDED */}
        <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-rose-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
              <h3 className="font-bold text-rose-950 text-xs uppercase tracking-wide">
                Dirty / Needs Cleaning ({dirtyRooms.length})
              </h3>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
            {dirtyRooms.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic bg-white rounded-lg border border-dashed border-slate-200">
                No rooms pending cleaning. Great job!
              </div>
            ) : (
              dirtyRooms.map((room) => (
                <div key={room.id} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                      <p className="text-[11px] text-slate-500">{room.roomTypeName} · {room.floor}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                      DIRTY
                    </span>
                  </div>

                  {room.assignedHousekeeper && (
                    <p className="text-[11px] text-slate-600 flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      Assigned: <span className="font-semibold text-slate-800">{room.assignedHousekeeper}</span>
                    </p>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => onOpenMaintenanceModal(room.id, room.roomNumber)}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
                    >
                      <Wrench className="h-3 w-3" /> Issue?
                    </button>
                    <button
                      onClick={() => onUpdateRoomStatus(room.id, 'CLEANING', currentSession?.name || 'Staff')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[11px] shadow-2xs"
                    >
                      Start Cleaning <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: CLEANING IN PROGRESS */}
        <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="font-bold text-amber-950 text-xs uppercase tracking-wide">
                Cleaning In Progress ({cleaningRooms.length})
              </h3>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
            {cleaningRooms.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs italic bg-white rounded-lg border border-dashed border-slate-200">
                No rooms currently undergoing cleaning.
              </div>
            ) : (
              cleaningRooms.map((room) => (
                <div key={room.id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                      <p className="text-[11px] text-slate-500">{room.roomTypeName} · {room.floor}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                      IN PROGRESS
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    Staff: <span className="font-semibold text-slate-800">{room.assignedHousekeeper || 'Housekeeping'}</span>
                  </p>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => onOpenMaintenanceModal(room.id, room.roomNumber)}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1"
                    >
                      <Wrench className="h-3 w-3" /> Report Mnt
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onUpdateRoomStatus(room.id, 'CLEAN', currentSession?.name || 'Staff')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded font-bold text-[11px] shadow-2xs"
                        title="Mark Clean (Awaiting Inspection)"
                      >
                        <Sparkles className="h-3 w-3" /> Clean
                      </button>
                      <button
                        onClick={() => onUpdateRoomStatus(room.id, 'AVAILABLE', currentSession?.name || 'Staff')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded font-bold text-[11px] shadow-2xs"
                        title="Inspect and release to inventory"
                      >
                        <Check className="h-3 w-3" /> Available
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: READY / AVAILABLE */}
        <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h3 className="font-bold text-emerald-950 text-xs uppercase tracking-wide">
                Inspected & Available ({availableRooms.length + cleanRooms.length})
              </h3>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
            {/* Rooms Cleaned awaiting final Inspection */}
            {cleanRooms.map((room) => (
              <div key={room.id} className="bg-white p-3.5 rounded-xl border border-teal-300 shadow-2xs space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                    <p className="text-[11px] text-slate-500">{room.roomTypeName} · {room.floor}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> CLEAN (INSPECT)
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Cleaned by {room.assignedHousekeeper || 'Staff'}</span>
                  <button
                    onClick={() => onUpdateRoomStatus(room.id, 'AVAILABLE', currentSession?.name || 'Supervisor')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded font-bold text-[10px] shadow-2xs"
                  >
                    <Check className="h-3 w-3" /> Approve Available
                  </button>
                </div>
              </div>
            ))}

            {availableRooms.map((room) => (
              <div key={room.id} className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-2xs space-y-1.5">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-black text-slate-900 text-sm">Room {room.roomNumber}</span>
                    <p className="text-[11px] text-slate-500">{room.roomTypeName} · {room.floor}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> READY
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Last Cleaned: {room.lastCleanedTime || 'Today'}</span>
                  <button
                    onClick={() => onUpdateRoomStatus(room.id, 'DIRTY')}
                    className="text-[10px] text-rose-700 hover:underline font-semibold"
                  >
                    Mark Dirty
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Housekeeping Tasks Tracker */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            Turnaround & Linen Tasks ({tasks.length})
          </h3>
          <span className="text-[11px] text-slate-500">Track task priority and completion</span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden text-xs">
          {tasks.map((task) => (
            <div key={task.id} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:bg-slate-50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">Room {task.roomNumber}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                    {task.taskType.replace('_', ' ')}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    task.priority === 'urgent' ? 'bg-rose-100 text-rose-800' :
                    task.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {task.priority}
                  </span>
                </div>
                {task.notes && (
                  <p className="text-[11px] text-slate-600">{task.notes}</p>
                )}
                <p className="text-[10px] text-slate-400">
                  Created: {task.createdTime} {task.assignedStaffName ? `· Assigned to: ${task.assignedStaffName}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {task.status === 'pending' && (
                  <button
                    onClick={() => handleTaskStatusChange(task, 'in_progress')}
                    className="px-2.5 py-1 bg-amber-500 text-white rounded text-[11px] font-bold hover:bg-amber-600"
                  >
                    Start Task
                  </button>
                )}
                {task.status === 'in_progress' && (
                  <button
                    onClick={() => handleTaskStatusChange(task, 'completed')}
                    className="px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold hover:bg-blue-700"
                  >
                    Complete
                  </button>
                )}
                {task.status === 'completed' && (
                  <button
                    onClick={() => handleTaskStatusChange(task, 'inspected')}
                    className="px-2.5 py-1 bg-emerald-700 text-white rounded text-[11px] font-bold hover:bg-emerald-800 flex items-center gap-1"
                  >
                    <ShieldCheck className="h-3 w-3" /> Inspect & Pass
                  </button>
                )}
                {task.status === 'inspected' && (
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Inspected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Assign Housekeeping Task</h3>
              <button onClick={() => setShowNewTaskModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Select Room:</label>
                <select
                  value={newTaskRoomId}
                  onChange={(e) => setNewTaskRoomId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      Room {r.roomNumber} ({r.roomTypeName}) - {r.status}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Task Type:</label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="clean_room">Full Clean Turnaround</option>
                    <option value="change_linen">Change Linen & Towels</option>
                    <option value="bathroom_cleaning">Bathroom Deep Clean</option>
                    <option value="restock_amenities">Restock Amenities</option>
                    <option value="inspect_room">Room Inspection</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Priority:</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Assign Housekeeper:</label>
                <select
                  value={newTaskStaff}
                  onChange={(e) => setNewTaskStaff(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="">-- Unassigned (Next Available) --</option>
                  {housekeepingStaff.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Instructions / Notes:</label>
                <textarea
                  rows={2}
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  placeholder="e.g. Guest requested fresh lavender sheets and 2 extra towels."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 text-white rounded-lg font-bold shadow-2xs"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
