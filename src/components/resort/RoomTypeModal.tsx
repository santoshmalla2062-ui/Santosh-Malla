import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Edit3, 
  Trash2, 
  BedDouble, 
  Check, 
  Sparkles, 
  DollarSign, 
  Users 
} from 'lucide-react';
import { BusinessSettings, RoomType, Session } from '../../types';
import { Language } from '../../utils/translations';
import { NumberInput } from '../common/NumberInput';

interface RoomTypeModalProps {
  roomTypes: RoomType[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onSaveRoomType: (roomType: RoomType, syncRooms?: boolean) => void;
  onArchiveRoomType: (roomTypeId: string) => void;
  onClose: () => void;
}

export const RoomTypeModal: React.FC<RoomTypeModalProps> = ({
  roomTypes,
  settings,
  currentSession,
  lang,
  onSaveRoomType,
  onArchiveRoomType,
  onClose
}) => {
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [name, setName] = useState('');
  const [nepaliName, setNepaliName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState<number>(4500);
  const [extraGuestPrice, setExtraGuestPrice] = useState<number>(1000);
  const [numberOfBeds, setNumberOfBeds] = useState<number>(1);
  const [maxAdults, setMaxAdults] = useState<number>(2);
  const [maxChildren, setMaxChildren] = useState<number>(1);
  const [totalCapacity, setTotalCapacity] = useState<number>(3);
  const [amenitiesStr, setAmenitiesStr] = useState('Mountain View, High-Speed WiFi, Hot Shower, Electric Kettle');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [syncToExistingRooms, setSyncToExistingRooms] = useState<boolean>(true);

  const startEdit = (rt: RoomType) => {
    setEditingType(rt);
    setName(rt.name);
    setNepaliName(rt.nepaliName || '');
    setDescription(rt.description);
    setBasePrice(rt.basePrice);
    setExtraGuestPrice(rt.extraGuestPrice || 1000);
    setNumberOfBeds(rt.numberOfBeds || 1);
    setMaxAdults(rt.maxAdults);
    setMaxChildren(rt.maxChildren);
    setTotalCapacity(rt.totalCapacity);
    setAmenitiesStr(rt.amenities.join(', '));
    setImageUrl(rt.imageUrl || '');
    setIsActive(rt.isActive);
  };

  const resetForm = () => {
    setEditingType(null);
    setName('');
    setNepaliName('');
    setDescription('');
    setBasePrice(4500);
    setExtraGuestPrice(1000);
    setNumberOfBeds(1);
    setMaxAdults(2);
    setMaxChildren(1);
    setTotalCapacity(3);
    setAmenitiesStr('Mountain View, High-Speed WiFi, Hot Shower, Electric Kettle');
    setImageUrl('');
    setIsActive(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const amenities = amenitiesStr
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    const typeData: RoomType = {
      id: editingType ? editingType.id : 'rt-' + Date.now(),
      name: name.trim(),
      nepaliName: nepaliName.trim() || undefined,
      description: description.trim(),
      basePrice,
      extraGuestPrice,
      numberOfBeds,
      maxAdults,
      maxChildren,
      totalCapacity: Math.max(totalCapacity, maxAdults + maxChildren),
      amenities,
      imageUrl: imageUrl.trim() || undefined,
      isActive
    };

    onSaveRoomType(typeData, Boolean(editingType && syncToExistingRooms));
    resetForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-emerald-300" />
            <div>
              <h3 className="font-bold text-sm">
                {lang === 'ne' ? 'कोठाका प्रकारहरू व्यवस्थापन (Room Types Management)' : 'Room Types & Category Management'}
              </h3>
              <p className="text-slate-400 text-[11px]">Define standard, deluxe, suites, cottages and villa categories</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 max-h-[75vh] overflow-y-auto text-xs">
          {/* List of Existing Room Types */}
          <div className="p-6 space-y-3 overflow-y-auto">
            <div className="flex justify-between items-center mb-1">
              <h4 className="font-bold text-slate-900 uppercase tracking-wide text-[10px] text-slate-500">
                Configured Room Types ({roomTypes.length})
              </h4>
              <button
                onClick={resetForm}
                className="text-[11px] font-bold text-emerald-800 hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> New Room Type
              </button>
            </div>

            <div className="space-y-3">
              {roomTypes.map((rt) => (
                <div
                  key={rt.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    editingType?.id === rt.id
                      ? 'border-emerald-700 bg-emerald-50/50 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h5 className="font-black text-slate-900 text-sm">{rt.name}</h5>
                      {rt.nepaliName && (
                        <p className="text-[11px] text-slate-500">{rt.nepaliName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rt.isActive ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {rt.isActive ? 'Active' : 'Archived'}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-600 text-[11px] line-clamp-2 my-1">{rt.description}</p>

                  <div className="flex flex-wrap items-center justify-between text-[11px] font-medium pt-2 border-t border-slate-200 text-slate-600">
                    <span className="font-mono-num font-bold text-emerald-900 text-xs">
                      {settings.currencySymbol} {rt.basePrice.toFixed(0)} / night
                    </span>
                    <span>Cap: {rt.maxAdults} Adults, {rt.maxChildren} Children</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(rt)}
                        className="text-emerald-800 hover:text-emerald-900 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onArchiveRoomType(rt.id)}
                        className="text-rose-700 hover:text-rose-900"
                      >
                        {rt.isActive ? 'Archive' : 'Restore'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Create / Edit Form */}
          <div className="p-6">
            <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-1.5">
              {editingType ? <Edit3 className="h-4 w-4 text-emerald-800" /> : <Plus className="h-4 w-4 text-emerald-800" />}
              {editingType ? `Edit Room Type: ${editingType.name}` : 'Create New Room Type'}
            </h4>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Room Type Name (English):</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Deluxe Lake-Facing Room"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nepali Name (नेपाली नाम):</label>
                <input
                  type="text"
                  value={nepaliName}
                  onChange={(e) => setNepaliName(e.target.value)}
                  placeholder="e.g. डिलक्स फेवा लेक भ्यू कोठा"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Base Price / Night ({settings.currencySymbol}):</label>
                  <NumberInput
                    min={0}
                    value={basePrice}
                    onValueChange={(val) => setBasePrice(val)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Extra Guest ({settings.currencySymbol}):</label>
                  <NumberInput
                    min={0}
                    value={extraGuestPrice}
                    onValueChange={(val) => setExtraGuestPrice(val)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Number of Beds:</label>
                  <NumberInput
                    min={1}
                    max={10}
                    integer
                    value={numberOfBeds}
                    onValueChange={(val) => setNumberOfBeds(val)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Max Adults:</label>
                  <NumberInput
                    min={1}
                    max={16}
                    integer
                    value={maxAdults}
                    onValueChange={(val) => setMaxAdults(val)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Max Children:</label>
                  <NumberInput
                    min={0}
                    max={10}
                    integer
                    value={maxChildren}
                    onValueChange={(val) => setMaxChildren(val)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Total Capacity:</label>
                  <NumberInput
                    min={1}
                    max={20}
                    integer
                    value={totalCapacity}
                    onValueChange={(val) => setTotalCapacity(val)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Amenities (Comma separated):</label>
                <input
                  type="text"
                  value={amenitiesStr}
                  onChange={(e) => setAmenitiesStr(e.target.value)}
                  placeholder="e.g. WiFi, AC, Balcony, Hot Shower, Jacuzzi"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Photo Image URL:</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Description:</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Atmosphere, views, bed type and luxury amenities."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActiveCheck"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-emerald-800 rounded border-slate-300"
                  />
                  <label htmlFor="isActiveCheck" className="text-slate-800 font-semibold cursor-pointer">
                    Active for bookings
                  </label>
                </div>

                {editingType && (
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncToExistingRooms}
                      onChange={(e) => setSyncToExistingRooms(e.target.checked)}
                      className="h-4 w-4 text-emerald-800 rounded border-emerald-400"
                    />
                    <span className="text-[11px]">
                      {lang === 'ne'
                        ? 'यस वर्गका सबै कोठामा नयाँ मूल्य र क्षमता लागू गर्नुहोस्'
                        : 'Apply updated rate, name & capacity to all existing rooms in this category'}
                    </span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                {editingType && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  {editingType ? 'Update Room Type' : 'Save Room Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
