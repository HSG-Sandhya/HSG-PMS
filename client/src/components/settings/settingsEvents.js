const EVENT_NAME = 'pms:settings-changed';

export const broadcastSettingsChange = (section, payload = null) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { section, payload } }),
  );
};

export const subscribeSettingsChange = (sections, handler) => {
  if (typeof window === 'undefined') return () => {};
  const wanted = Array.isArray(sections) ? sections : [sections];
  const listener = (event) => {
    const section = event?.detail?.section;
    if (!section) return;
    if (wanted.includes('*') || wanted.includes(section)) {
      handler(section, event.detail.payload);
    }
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};

export const SETTINGS_EVENT = EVENT_NAME;
