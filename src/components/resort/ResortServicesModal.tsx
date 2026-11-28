import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Plus, 
  Check, 
  DollarSign, 
  Tag, 
  Compass, 
  Car, 
  Coffee, 
  Utensils, 
  Bed, 
  Shirt, 
  Smile, 
  AlertCircle 
} from 'lucide-react';
import { NumberInput } from '../common/NumberInput';
import { 
  BusinessSettings, 
  FolioCategory, 
  GuestFolioItem, 
  Reservation, 
  ResortRoom, 
  ResortService, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';

interface ResortServicesModalProps {
  services: ResortService[];
  occupiedRooms: ResortRoom[];
  reservations: Reservation[];
  currentSession: Session | null;
  settings: BusinessSettings;
  lang: Language;
  onAddChargeToRoom: (folioItem: Omit<GuestFolioItem, 'id'>) => void;
  onSaveService: (service: ResortService) => void;
  onClose: () => void;
}

export const ResortServicesModal: React.FC<ResortServicesModalProps> = ({
  services,
  occupiedRooms,
  reservations,
  currentSession,
  settings,
  lang,
  onAddChargeToRoom,
  onSaveService,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'post_charge' | 'add_service'>('post_charge');
  
  // Post charge form
  const [selectedRoomId, setSelectedRoomId] = useState<string>(occupiedRooms[0]?.id || '');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<FolioCategory>('SPA');
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // New service item form
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<FolioCategory>('OTHER_SERVICE');
  const [newServicePrice, setNewServicePrice] = useState<number>(1000);
  const [newServiceDesc, setNewServiceDesc] = useState('');

  const selectedRoom = occupiedRooms.find(r => r.id === selectedRoomId);
  const selectedReservation = reservations.find(r => r.id === selectedRoom?.currentReservationId);
  const selectedService = services.find(s => s.id === selectedServiceId);
  const effectiveUnitPrice = customPrice !== null ? customPrice : (selectedService?.price || 0);

  const handleSelectServicePreset = (service: ResortService) => {
    setSelectedServiceId(service.id);
    setSelectedCategory(service.category);
    setCustomDescription(service.name);
    setCustomPrice(service.price);
  };

  const handlePostCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !selectedReservation) {
      setPostSuccess(null);
      setPostError('Please select an occupied room.');
      return;
    }
    setPostError(null);

    const price = effectiveUnitPrice;
    const desc = customDescription.trim() || selectedService?.name || 'Resort Service';
    const total = price * quantity;

    const item: Omit<GuestFolioItem, 'id'> = {
      reservationId: selectedReservation.id,
      roomId: selectedRoom.id,
      roomNumber: selectedRoom.roomNumber,
      dateTime: new Date().toISOString().replace('T', ' ').substring(0, 16),
      description: desc,
      category: selectedCategory,
      quantity,
      unitPrice: price,
      totalPrice: total,
      addedByStaff: currentSession?.name || 'Staff'
    };

    onAddChargeToRoom(item);
    setPostSuccess(`Successfully posted ${desc} (${settings.currencySymbol} ${total.toFixed(2)}) to Room ${selectedRoom.roomNumber}!`);
    setTimeout(() => setPostSuccess(null), 4000);
  };

  const handleCreateNewService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newService: ResortService = {
      id: 'srv-' + Date.now(),
      name: newServiceName.trim(),
      category: newServiceCategory,
      description: newServiceDesc.trim(),
      price: newServicePrice,
      taxPercent: 13,
      isAvailable: true,
      isActive: true
    };

    onSaveService(newService);
    setNewServiceName('');
    setNewServiceDesc('');
    setActiveTab('catalog');
  };

  const getCategoryIcon = (category: FolioCategory) => {
    switch (category) {
      case 'SPA': return <Smile className="h-4 w-4 text-purple-600" />;
      case 'TRANSPORT': return <Car className="h-4 w-4 text-blue-600" />;
      case 'LAUNDRY': return <Shirt className="h-4 w-4 text-cyan-600" />;
      case 'BREAKFAST': return <Coffee className="h-4 w-4 text-amber-600" />;
      case 'ROOM': return <Bed className="h-4 w-4 text-indigo-600" />;
      default: return <Sparkles className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-800" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {lang === 'ne' ? 'रिसोर्ट सेवा तथा थप शुल्क (Resort Services & Folio Charges)' : 'Resort Services & Guest Room Charges'}
              </h3>
              <p className="text-[11px] text-slate-500">Post extra amenities, spa, tours, and laundry to guest folios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('post_charge')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'post_charge'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Post Charge to Room
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'catalog'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Service Catalog ({services.length})
          </button>
          <button
            onClick={() => setActiveTab('add_service')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'add_service'
                ? 'border-emerald-800 text-emerald-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            + Add New Service
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {postSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-emerald-900 text-xs font-bold animate-in fade-in">
              <Check className="h-4 w-4 text-emerald-700 shrink-0" />
              <span>{postSuccess}</span>
            </div>
          )}

          {postError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-300 rounded-lg flex items-center gap-2 text-rose-900 text-xs font-bold animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" />
              <span>{postError}</span>
            </div>
          )}

          {activeTab === 'post_charge' && (
            <form onSubmit={handlePostCharge} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Occupied Room:
                </label>
                {occupiedRooms.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                    No rooms are currently occupied. Check in a guest to post charges.
                  </div>
                ) : (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      if (postError) setPostError(null);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-700"
                    required
                  >
                    {occupiedRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        Room {room.roomNumber} - {room.currentGuestName} ({room.roomTypeName})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quick Preset Service Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Service from Catalog:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {services.map((srv) => (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => handleSelectServicePreset(srv)}
                      className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                        selectedServiceId === srv.id
                          ? 'border-emerald-700 bg-emerald-50/70 ring-1 ring-emerald-700'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-0.5">
                        {getCategoryIcon(srv.category)}
                        <span className="truncate">{srv.name}</span>
                      </div>
                      <p className="font-mono-num font-bold text-emerald-800 text-[11px]">
                        {settings.currencySymbol} {srv.price.toFixed(0)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Charge Description & Price Override */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Charge Description:
                  </label>
                  <input
                    type="text"
                    value={customDescription || selectedService?.name || ''}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                    placeholder="e.g. Airport SUV Drop, Spa 60 min"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category:
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as FolioCategory)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    <option value="SPA">SPA & Wellness</option>
                    <option value="TRANSPORT">TRANSPORT / Taxi</option>
                    <option value="LAUNDRY">LAUNDRY</option>
                    <option value="BREAKFAST">BREAKFAST / Meal</option>
                    <option value="ROOM">ROOM Upgrade / Extra Bed</option>
                    <option value="OTHER_SERVICE">OTHER SERVICE / Tour</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity:
                  </label>
                  <NumberInput
                    min={1}
                    integer
                    emptyValue={1}
                    value={quantity}
                    onValueChange={(val) => setQuantity(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-num font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unit Price ({settings.currencySymbol}):
                  </label>
                  <NumberInput
                    min={0}
                    value={effectiveUnitPrice}
                    onValueChange={(val) => setCustomPrice(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Total Charge to Post:</span>
                <span className="text-base font-black text-emerald-900 font-mono-num">
                  {settings.currencySymbol} {(effectiveUnitPrice * quantity).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={occupiedRooms.length === 0}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors"
                >
                  Post to Room Folio
                </button>
              </div>
            </form>
          )}

          {activeTab === 'catalog' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-600 font-medium">Available Resort Services Catalog</p>
                <button
                  onClick={() => setActiveTab('add_service')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900"
                >
                  <Plus className="h-3.5 w-3.5" /> Add New
                </button>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {services.map((srv) => (
                  <div key={srv.id} className="p-3 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-100">
                        {getCategoryIcon(srv.category)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{srv.name}</h4>
                        <p className="text-[11px] text-slate-500">{srv.description}</p>
                        <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase mt-0.5">
                          {srv.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900 font-mono-num">
                        {settings.currencySymbol} {srv.price.toFixed(0)}
                      </p>
                      <button
                        onClick={() => {
                          handleSelectServicePreset(srv);
                          setActiveTab('post_charge');
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:underline mt-1"
                      >
                        Charge Room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'add_service' && (
            <form onSubmit={handleCreateNewService} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Service Name:
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  placeholder="e.g. Paragliding Booking Assistance, Mountain Bike Rental"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Category:
                  </label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value as FolioCategory)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  >
                    <option value="SPA">SPA</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="LAUNDRY">LAUNDRY</option>
                    <option value="BREAKFAST">BREAKFAST</option>
                    <option value="ROOM">ROOM</option>
                    <option value="OTHER_SERVICE">OTHER SERVICE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Price ({settings.currencySymbol}):
                  </label>
                  <NumberInput
                    min={0}
                    value={newServicePrice}
                    onValueChange={(val) => setNewServicePrice(val)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono-num font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description:
                </label>
                <textarea
                  rows={2}
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  placeholder="Brief description of the service and terms"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-lg shadow-2xs transition-colors"
                >
                  Save Service
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
