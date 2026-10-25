import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children?: ReactNode;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, ...rest },
  ref,
) {
  return (
    <RouterLink ref={ref} to={href} {...rest}>
      {children}
    </RouterLink>
  );
});

export default Link;
export { Link };
