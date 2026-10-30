import { useReveal } from '../hooks/useReveal.js';

/** Fades its child up the first time it scrolls into view. `as` picks the tag. */
export default function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={`${className} rv${shown ? ' in' : ''}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
