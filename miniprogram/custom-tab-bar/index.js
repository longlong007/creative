Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '记录', icon: 'edit' },
      { pagePath: '/pages/timeline/timeline', text: '时间轴', icon: 'time' },
      { pagePath: '/pages/growth/growth', text: '生长', icon: 'grow' },
      { pagePath: '/pages/family/family', text: '家庭', icon: 'home' }
    ]
  },
  methods: {
    switchTab(e) {
      const idx = Number(e.currentTarget.dataset.index)
      const item = this.data.list[idx]
      wx.switchTab({ url: item.pagePath })
    }
  }
})
