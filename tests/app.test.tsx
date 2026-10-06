import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Capture from '../src/components/Capture'

vi.mock('../src/ml/modelLoader', async (orig) => ({
  ...(await orig<typeof import('../src/ml/modelLoader')>()),
  loadModel: vi.fn(async () => { throw new Error('model.json 404') }),
}))

describe('camera fallback', () => {
  it('shows "Camera unavailable" and a gallery option when permission fails', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
    })
    render(<Capture crop="Lemon" tips={["t"]} onBack={() => {}} onAnalyze={() => {}} />)
    expect(await screen.findByText('Camera unavailable')).toBeTruthy()
    const gallery = screen.getByText('Choose from gallery')
    expect(gallery).toBeTruthy()
    fireEvent.click(gallery) // must not throw
  })
})

describe('model load failure', () => {
  it('shows Lemon AI unavailable and never claims offline readiness', async () => {
    const { ModelProvider } = await import('../src/hooks/useModels')
    const { default: Home } = await import('../src/components/Home')
    render(<ModelProvider><Home onLemon={() => {}} onOther={() => {}} onHistory={() => {}} online offlineReady={false} displayName={(_c, l) => l} /></ModelProvider>)
    await waitFor(() => expect(screen.getByText('Lemon AI unavailable.')).toBeTruthy())
    expect(screen.queryByText('AI ready offline')).toBeNull()
    expect((screen.getByRole('button', { name: /Scan a lemon leaf/ }) as HTMLButtonElement).disabled).toBe(true)
  })
})
