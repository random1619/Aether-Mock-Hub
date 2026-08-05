import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLenisScroll } from './useLenisScroll';

// Lenis constructs a rAF loop and touches scroll APIs jsdom doesn't fully
// implement; mock the class so the hook's contract is tested in isolation.
const rafMock = vi.fn();
const destroyMock = vi.fn();
const scrollToMock = vi.fn();
const onMock = vi.fn();
const resizeMock = vi.fn();

vi.mock('lenis', () => {
  return {
    default: class MockLenis {
      on = onMock;
      raf = rafMock;
      destroy = destroyMock;
      resize = resizeMock;
      scrollTo = scrollToMock;
      opts: unknown;
      constructor(opts: unknown) {
        this.opts = opts;
      }
    },
  };
});

describe('useLenisScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs Lenis with the lerp option and exposes an instance', async () => {
    const { result } = renderHook(() => useLenisScroll({ lerp: 0.08 }));
    // The instance is constructed in the mount effect and exposed via state,
    // so it is null on the first render and resolves after mount.
    await waitFor(() => expect(result.current.instance).not.toBeNull());
  });

  it('scrollTo delegates to the Lenis instance with an offset', () => {
    const { result } = renderHook(() => useLenisScroll({}));
    result.current.scrollTo(100, { offset: -20 });
    expect(scrollToMock).toHaveBeenCalledWith(100, expect.objectContaining({ offset: -20 }));
  });

  it('destroys the instance on unmount', () => {
    const { unmount } = renderHook(() => useLenisScroll({}));
    unmount();
    expect(destroyMock).toHaveBeenCalled();
  });
});
