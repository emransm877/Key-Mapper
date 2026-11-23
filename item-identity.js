// Shared logical item identity. Customer/agent task IDs can differ for one scenario.
(() => {
  const parse = value => {
    if (typeof value !== 'string' || !/^[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*$/i.test(value)) return null;
    // Only normalize the observed task-ID grammar (pc01, tp01, ...). Ordinary
    // scenario names such as customer_service are not role suffixes.
    const suffix = value.match(/_(customer|agent)_([a-z]+\d+)$/i);
    const role = suffix && suffix.index > value.indexOf('__') + 2 ? suffix : null;
    return { item: value, key: (role ? value.slice(0, role.index) : value).toLowerCase(), role: role ? role[1].toLowerCase() : null };
  };
  const sameScenario = (left, right) => {
    const a = parse(left), b = parse(right);
    return !!(a && b && a.key === b.key);
  };
  const isAgentItem = value => {
    const item = parse(value);
    return !!item && item.role !== 'customer';
  };
  const resolveAgentOption = (target, labels) => {
    const candidates = [...new Set(labels)].filter(label => isAgentItem(label) && sameScenario(label, target));
    return { item: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
  };
  globalThis.KeyMapperItems = Object.freeze({ parse, sameScenario, isAgentItem, resolveAgentOption });
})();
