// Shared scenario identity and exact customer/agent task-variant matching.
(() => {
  const parse = value => {
    if (typeof value !== 'string' || !/^[a-z0-9]+(?:_[a-z0-9]+)*__[a-z0-9]+(?:_[a-z0-9]+)*$/i.test(value)) return null;
    // Only normalize the observed task-ID grammar (pc01, tp01, ...). Ordinary
    // scenario names such as customer_service are not role suffixes.
    const suffix = value.match(/_(customer|agent)_([a-z]+\d+)$/i);
    const role = suffix && suffix.index > value.indexOf('__') + 2 ? suffix : null;
    return { item: value, key: (role ? value.slice(0, role.index) : value).toLowerCase(),
      role: role ? role[1].toLowerCase() : null, roleId: role ? role[2].toLowerCase() : null };
  };
  const sameScenario = (left, right) => {
    const a = parse(left), b = parse(right);
    return !!(a && b && a.key === b.key);
  };
  const isAgentItem = value => {
    const item = parse(value);
    return !!item && item.role !== 'customer';
  };
  const sameTask = (left, right) => {
    const a = parse(left), b = parse(right);
    return !!(a && b && a.key === b.key && a.roleId === b.roleId);
  };
  const resolveAgentOption = (target, labels) => {
    const requested = parse(target);
    if (!requested) return { item: null, ambiguous: false };
    const scenarioOptions = [...new Set(labels)].filter(label => isAgentItem(label) && sameScenario(label, target));
    const candidates = scenarioOptions.filter(label => sameTask(label, target));
    // A caller with an explicit task ID must never fall back to another ID.
    // Without an ID, accept only the exact legacy no-role item and no ambiguity.
    const ambiguous = requested.roleId ? candidates.length > 1 : scenarioOptions.length > 1;
    return { item: !ambiguous && candidates.length === 1 ? candidates[0] : null, ambiguous };
  };
  globalThis.KeyMapperItems = Object.freeze({ parse, sameScenario, sameTask, isAgentItem, resolveAgentOption });
})();
