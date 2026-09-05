function tabBar(page) {
  if (typeof page.getTabBar === 'function') return page.getTabBar()
  return null
}

function hideTabBar(page) {
  const bar = tabBar(page)
  if (bar) bar.setData({ hidden: true })
}

function showTabBar(page, selected) {
  const bar = tabBar(page)
  if (!bar) return
  const patch = { hidden: false }
  if (selected != null) patch.selected = selected
  bar.setData(patch)
}

module.exports = { hideTabBar, showTabBar }
