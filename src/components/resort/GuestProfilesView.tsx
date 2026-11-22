import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Calendar, 
  History, 
  Check, 
  X, 
  FileText, 
  ShieldCheck, 
  Edit3, 
  Building2, 
  Star,
  Hotel
} from 'lucide-react';
import { 
  BusinessSettings, 
  GuestProfile, 
  HotelPaymentRecord, 
  Reservation, 
  Session 
} from '../../types';
import { Language } from '../../utils/translations';

interface GuestProfilesViewProps {
  guests: GuestProfile[];
  reservations: Reservation[];
  payments: HotelPaymentRecord[];
  settings: BusinessSettings;
  currentSession: Session | null;
  lang: Language;
  onSaveGuest: (guest: GuestProfile) => void;
  onSelectGuestForBooking?: (guest: GuestProfile) => void;
}

export const GuestProfilesView: React.FC<GuestProfilesViewProps> = ({
  guests,
  reservations,
  payments,
  settings,
  currentSession,
  lang,
  onSaveGuest,
  onSelectGuestForBooking
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<GuestProfile | null>(guests[0] || null);
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<GuestProfile | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Nepal');
  const [idType, setIdType] = useState<GuestProfile['idType']>('Citizenship');
  const [idNumber, setIdNumber] = useState('');
  const [notes, setNotes] = useState('');

  const filteredGuests = guests.filter(g => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      g.fullName.toLowerCase().includes(q) ||
      g.phone.includes(q) ||
      g.email.toLowerCase().includes(q) ||
      g.idNumber.toLowerCase().includes(q) ||
      g.country.toLowerCase().includes(q)
    );
  });

  const activeGuest = selectedGuest || filteredGuests[0] || null;

  // Stays for active guest
  const guestReservations = activeGuest 
    ? reservations.filter(r => r.guestPhone === activeGuest.phone || r.guestId === activeGuest.id)
    : [];

  const guestPayments = activeGuest
    ? payments.filter(p => guestReservations.some(r => r.id === p.reservationId))
    : [];

  const totalNightsStayed = guestReservations
    .filter(r => r.status === 'CHECKED_OUT' || r.status === 'CHECKED_IN')
    .reduce((s, r) => s + r.nightsCount, 0);

  const totalHistoricalSpend = guestReservations
    .reduce((s, r) => s + r.paidAmount, 0);

  const startCreate = () => {
    setEditingGuest(null);
    setFullName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCountry('Nepal');
    setIdType('Citizenship');
    setIdNumber('');
    setNotes('');
    setShowAddEditModal(true);
  };

  const startEdit = (g: GuestProfile) => {
    setEditingGuest(g);
    setFullName(g.fullName);
    setPhone(g.phone);
    setEmail(g.email);
    setAddress(g.address);
    setCountry(g.country);
    setIdType(g.idType);
    setIdNumber(g.idNumber);
    setNotes(g.notes || '');
    setShowAddEditModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    const guestData: GuestProfile = {
      id: editingGuest ? editingGuest.id : 'gst-' + Date.now(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      country: country.trim() || 'Nepal',
      idType,
      idNumber: idNumber.trim(),
      notes: notes.trim() || undefined,
      totalStays: editingGuest ? editingGuest.totalStays : 1,
      createdAt: editingGuest ? editingGuest.createdAt : new Date().toISOString().split('T')[0]
    };

    onSaveGuest(guestData);
    setSelectedGuest(guestData);
    setShowAddEditModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-800" />
            {lang === 'ne' ? 'पाहुना प्रोफाइल तथा इतिहास (Guest Directory & Stay History)' : 'Guest Directory & Stay History'}
          </h2>
          <p className="text-xs text-slate-500">
            Secure, business-scoped guest records, preferences, previous stays and folios
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          <button
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs shadow-2xs whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Guest</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Directory on Left, Profile Details on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Guest List */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          <div className="p-3 bg-slate-50 font-bold text-xs text-slate-700 uppercase tracking-wide flex justify-between items-center">
            <span>Registered Guests ({filteredGuests.length})</span>
            <ShieldCheck className="h-4 w-4 text-emerald-700" />
          </div>

          {filteredGuests.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No matching guest profiles found.
            </div>
          ) : (
            filteredGuests.map((g) => {
              const isSelected = activeGuest?.id === g.id;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGuest(g)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-emerald-50/70 border-l-4 border-l-emerald-800' 
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-slate-900 text-xs">{g.fullName}</h4>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {g.totalStays} {g.totalStays === 1 ? 'Stay' : 'Stays'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>{g.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{g.address || g.country}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Detailed Profile, Stay History & Payments */}
        <div className="lg:col-span-8 space-y-4">
          {activeGuest ? (
            <>
              {/* Profile Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900">{activeGuest.fullName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {activeGuest.idType}: {activeGuest.idNumber || 'Not recorded'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Guest ID: <span className="font-mono">{activeGuest.id}</span> · Member since {activeGuest.createdAt}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(activeGuest)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                    </button>
                    {onSelectGuestForBooking && (
                      <button
                        onClick={() => onSelectGuestForBooking(activeGuest)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors"
                      >
                        <Hotel className="h-3.5 w-3.5" /> New Booking
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Total Bookings</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{guestReservations.length}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Total Nights</span>
                    <p className="text-lg font-black text-slate-900 mt-0.5">{totalNightsStayed}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-800">Lifetime Spend</span>
                    <p className="text-lg font-black text-emerald-950 font-mono-num mt-0.5">
                      {settings.currencySymbol} {totalHistoricalSpend.toFixed(0)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Country</span>
                    <p className="text-sm font-bold text-slate-900 mt-1 truncate">{activeGuest.country}</p>
                  </div>
                </div>

                {/* Contact & Notes details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <h5 className="font-bold text-slate-700 uppercase text-[10px]">Contact Info</h5>
                    <p className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{activeGuest.phone}</span>
                    </p>
                    {activeGuest.email && (
                      <p className="flex items-center gap-2 text-slate-700">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span>{activeGuest.email}</span>
                      </p>
                    )}
                    {activeGuest.address && (
                      <p className="flex items-center gap-2 text-slate-700">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{activeGuest.address}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h5 className="font-bold text-slate-700 uppercase text-[10px]">Guest Preferences & Notes</h5>
                    <div className="p-2.5 bg-amber-50/60 rounded-lg border border-amber-200 text-amber-950 text-xs italic">
                      {activeGuest.notes || 'No special preferences or VIP instructions recorded.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stay History Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-2 p-4">
                <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 uppercase tracking-wide text-slate-600">
                  <History className="h-4 w-4 text-emerald-800" />
                  Reservation & Stay History
                </h4>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                        <th className="py-2 px-3">Booking #</th>
                        <th className="py-2 px-3">Room</th>
                        <th className="py-2 px-3">Dates</th>
                        <th className="py-2 px-2 text-center">Nights</th>
                        <th className="py-2 px-3 text-right">Total</th>
                        <th className="py-2 px-3 text-right">Paid</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {guestReservations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-slate-400 italic">
                            No stay records found for this guest.
                          </td>
                        </tr>
                      ) : (
                        guestReservations.map((res) => (
                          <tr key={res.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                              {res.id}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              Room {res.roomNumber} <span className="text-[10px] text-slate-500 font-normal">({res.roomTypeName})</span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                              {res.checkInDate} &rarr; {res.checkOutDate}
                            </td>
                            <td className="py-2 px-2 text-center font-mono-num font-semibold">
                              {res.nightsCount}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num font-bold text-slate-900">
                              {settings.currencySymbol} {res.totalAmount.toFixed(0)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-num font-bold text-emerald-800">
                              {settings.currencySymbol} {res.paidAmount.toFixed(0)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                res.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-900' :
                                res.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-900' :
                                res.status === 'CHECKED_OUT' ? 'bg-slate-200 text-slate-700' :
                                'bg-rose-100 text-rose-900'
                              }`}>
                                {res.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400 text-xs italic">
              Select a guest profile on the left or add a new guest to view details.
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Guest Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-auto">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-300" />
                <h3 className="font-bold text-sm">
                  {editingGuest ? 'Edit Guest Profile' : 'Register New Guest Profile'}
                </h3>
              </div>
              <button onClick={() => setShowAddEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Karki"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono-num font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="guest@example.com"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Country</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Nepal"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Permanent / Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. New Baneshwor, Kathmandu"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ID Document Type</label>
                  <select
                    value={idType}
                    onChange={(e) => setIdType(e.target.value as GuestProfile['idType'])}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="Citizenship">Citizenship (नागरिकता)</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="National ID">National ID Card</option>
                    <option value="Other">Other Official ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Document Number</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    placeholder="Document reference ID"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Staff Notes & Preferences</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. VIP guest, likes high floor, vegetarian breakfast preference..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-lg shadow-2xs"
                >
                  Save Guest Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
