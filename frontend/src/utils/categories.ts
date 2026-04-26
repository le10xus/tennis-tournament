export interface Category {
  value: string
  label: string
  kind: 'singles' | 'doubles'
  gender: 'male' | 'female' | 'mixed'
}

export const CATEGORIES: Category[] = [
  { value: 'singles_male',   label: 'Одиночный мужской', kind: 'singles', gender: 'male' },
  { value: 'singles_female', label: 'Одиночный женский',  kind: 'singles', gender: 'female' },
  { value: 'singles_mixed',  label: 'Одиночный микст',   kind: 'singles', gender: 'mixed' },
  { value: 'doubles_male',   label: 'Парный мужской',     kind: 'doubles', gender: 'male' },
  { value: 'doubles_female', label: 'Парный женский',     kind: 'doubles', gender: 'female' },
  { value: 'doubles_mixed',  label: 'Парный микст',       kind: 'doubles', gender: 'mixed' },
]

export function categoryValue(kind: string, gender: string): string {
  return `${kind}_${gender}`
}

export function categoryLabel(kind: string, gender: string): string {
  return CATEGORIES.find(c => c.kind === kind && c.gender === gender)?.label
    ?? `${kind} ${gender}`
}
