import './Panel.css';

export default function Panel({ title, right, className = '', children, as: Comp = 'div', ...rest }) {
  return (
    <Comp className={`panel glass ${className}`} {...rest}>
      {title && (
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot" />
            <span className="panel-title-text">{title}</span>
          </span>
          {right}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </Comp>
  );
}
