import { Directive } from '@angular/core';

@Directive({
  selector: '[appEyebrow]',
  host: { class: 'text-label font-semibold tracking-eyebrow text-text-muted uppercase' },
})
export class EyebrowDirective {}

@Directive({
  selector: 'button[appInlineDeleteButton]',
  host: { class: 'inline-flex cursor-pointer items-center justify-center rounded-sm border border-line-strong bg-transparent px-[0.4rem] py-[0.1rem] font-body text-small leading-none font-medium text-text-muted transition-[background-color,border-color] duration-200 ease-out hover:not-disabled:border-text-muted hover:not-disabled:bg-canvas motion-reduce:transition-none' },
})
export class InlineDeleteButtonDirective {}
