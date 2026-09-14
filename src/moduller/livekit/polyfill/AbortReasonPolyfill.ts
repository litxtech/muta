/**
 * RN `abort-controller` polyfill AbortSignal.reason desteklemiyor.
 * LiveKit disconnect sırasında `abort(msg)` çağırır; reason undefined kalır ve
 * livekit-client ` 'toString' in reason ` ile TypeError fırlatır.
 * Bu polyfill reason alanını spec’e uygun hale getirir.
 */

const reasonMap = new WeakMap<object, unknown>();

function polyfillAbortReason() {
  const AC = globalThis.AbortController;
  const AS = globalThis.AbortSignal;
  if (!AC || !AS) return;

  const proto = AS.prototype as AbortSignal & { reason?: unknown };
  if (!Object.prototype.hasOwnProperty.call(proto, 'reason')) {
    Object.defineProperty(proto, 'reason', {
      configurable: true,
      enumerable: true,
      get(this: AbortSignal) {
        if (reasonMap.has(this)) return reasonMap.get(this);
        return this.aborted ? 'Aborted' : undefined;
      },
    });
  }

  const originalAbort = AC.prototype.abort;
  if ((originalAbort as { __tamusoPatched?: boolean }).__tamusoPatched) return;

  function patchedAbort(this: AbortController, reason?: unknown) {
    const signal = this.signal;
    reasonMap.set(signal, reason !== undefined ? reason : 'Aborted');
    // Eski polyfill reason argümanını yoksayar — yine de çağır.
    return originalAbort.call(this);
  }
  (patchedAbort as { __tamusoPatched?: boolean }).__tamusoPatched = true;
  AC.prototype.abort = patchedAbort;
}

try {
  polyfillAbortReason();
} catch (e) {
  console.warn('[AbortReasonPolyfill]', e);
}
