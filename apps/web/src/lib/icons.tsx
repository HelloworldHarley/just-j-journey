import {
  AlarmClock,
  Bike,
  BedDouble,
  Bus,
  CalendarCheck,
  Car,
  Coffee,
  CarTaxiFront,
  Footprints,
  KeyRound,
  Landmark,
  LogIn,
  LogOut,
  MapPin,
  Mountain,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Ship,
  Sunset,
  Ticket,
  TrainFront,
  TramFront,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react'

/**
 * lucide 而非 emoji。
 *
 * emoji 在各平台渲染差异很大，而且 ✈ (U+2708) 默认是文本呈现、🚊 是彩色呈现，
 * 混排会一半单色一半彩色。lucide 的几何线条风格也更贴「导视系统」这个母题。
 */
const REGISTRY: Record<string, LucideIcon> = {
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  TrainFront,
  TramFront,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  Bike,
  Ship,
  BedDouble,
  UtensilsCrossed,
  Coffee,
  Wine,
  Landmark,
  Ticket,
  Mountain,
  Sunset,
  KeyRound,
  AlarmClock,
  CalendarCheck,
  LogIn,
  LogOut,
}

export function iconFor(name: string): LucideIcon {
  return REGISTRY[name] ?? MapPin
}
