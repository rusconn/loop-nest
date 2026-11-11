// CustomEventのみを対象とする。GlobalEventHandlersEventMapに定義のないイベントはdispatchできない。
export function dispatchTypedEvent<Type extends keyof GlobalEventHandlersEventMap & string>(
  target: EventTarget,
  type: Type,
  detail: GlobalEventHandlersEventMap[Type] extends CustomEvent<infer Detail> ? Detail : never,
  options?: EventInit,
) {
  target.dispatchEvent(
    new CustomEvent(type, {
      detail,
      bubbles: false,
      ...options,
    }),
  );
}
