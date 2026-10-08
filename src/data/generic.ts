import type { ConditionInfo, Severity } from './types'

/** Placeholder content: generic guidance derived from the class label. */
export function genericInfo(name: string, crop: string, severity: Severity): ConditionInfo {
  if (severity === 'none') {
    return {
      name, crop, severity,
      shortDescription: 'The leaf looks healthy. No signs of disease or pests were found.',
      visualSigns: ['Even green colour', 'No spots, lesions or holes', 'No curling, wilting or sticky residue'],
      generalNextSteps: ['Keep watering at the base of the plant, not over the leaves.', 'Check again in a week, or sooner if you see changes.'],
    }
  }
  return {
    name, crop, severity,
    shortDescription: `The leaf shows signs consistent with ${name.toLowerCase()}.`,
    visualSigns: ['Compare the leaf with trusted photos of this problem', 'Check the underside of the leaf and nearby plants'],
    generalNextSteps: [
      'Move or separate the affected plant if you can, and avoid touching healthy plants afterwards.',
      'Remove badly affected leaves and bin them (do not compost).',
      'Water at the base and avoid wetting the leaves.',
      'Clean tools after use. Ask a local garden centre about treatment options.',
    ],
    note: 'General guidance only. Confirm with a local expert before treating.',
  }
}

export const prettify = (s: string) => s.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim()
