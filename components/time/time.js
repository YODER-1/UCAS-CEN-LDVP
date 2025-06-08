// 标准颜色方案：蓝橙红绿
const standardColors = {
    primary: ["#0288d1", "#ff9800", "#f44336", "#4caf50"],
    line: "#ff9800",
    background: "#e6e6e6"
};

// 创建tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

d3.json("../../data/time_behavior.json").then(data => {


    // 更新KPI指标
    updateKPIs(data);

    // 创建并更新图表，添加错误处理
    try {
        if (data.daily_active_users) {
            createLineChart(data);
        }
        if (data.calendar_heatmap_data) {
            createCalendarHeatmap(data);
        }
        createHourBarChart(data);
        createWeekdayBarChart(data);
    } catch (error) {
        console.error('图表创建失败:', error);
    }
}).catch(error => {
    console.error('数据加载失败:', error);
});

// 更新KPI指标
function updateKPIs(data) {
    try {
        if (data.user_time_concentration_avg !== undefined) {
            document.getElementById("time-concentration").textContent =
                (data.user_time_concentration_avg * 100).toFixed(1) + "%";
        }
        if (data.user_study_rhythm_stability_avg !== undefined) {
            // 将时间戳标准差转换为天数显示
            const rawStability = data.user_study_rhythm_stability_avg;
            const days = (rawStability / (24 * 3600)).toFixed(1); // 转换为天数

            document.getElementById("rhythm-stability").textContent =
                days + "天";
        }
    } catch (error) {
        console.error('KPI更新失败:', error);
    }
}


// 创建折线图
function createLineChart(data) {
    const svg = d3.select("#line-chart");
    const margin = { top: 40, right: 100, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;

    // 清除已有内容
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 处理数据
    const dailyData = data.daily_active_users;

    // 计算月平均值
    const monthlyAvg = d3.rollup(dailyData,
        v => d3.mean(v, d => d.active_users),
        d => d3.timeFormat("%Y-%m")(new Date(d.date))
    );

    // 创建比例尺
    const x = d3.scaleTime()
        .domain(d3.extent(dailyData, d => new Date(d.date)))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(dailyData, d => d.active_users)])
        .range([height, 0]);

    // 添加x轴
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    // 添加y轴
    g.append("g")
        .call(d3.axisLeft(y));

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + 50)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("日期");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("学习人次");

    // 添加网格线
    g.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.1)
        .call(d3.axisLeft(y)
            .tickSize(-width)
            .tickFormat(""));

    // 创建日活折线
    const line = d3.line()
        .x(d => x(new Date(d.date)))
        .y(d => y(d.active_users))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = g.append("path")
        .datum(dailyData)
        .attr("fill", "none")
        .attr("stroke", "#0288d1")
        .attr("stroke-width", 2)
        .attr("d", line);

    // 添加折线动画
    const totalLength = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(2000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // 创建月平均线 - 修正X轴位置，让月平均值显示在该月中间
    const monthlyLine = d3.line()
        .x(d => {
            // 将月平均值显示在该月的15号（中间位置）
            const year = d[0].split('-')[0];
            const month = d[0].split('-')[1];
            return x(new Date(year, month - 1, 15));
        })
        .y(d => y(d[1]))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const monthlyPath = g.append("path")
        .datum(Array.from(monthlyAvg))
        .attr("fill", "none")
        .attr("stroke", standardColors.line)
        .attr("stroke-width", 2)
        .attr("d", monthlyLine);

    // 添加月平均线动画
    const monthlyLength = monthlyPath.node().getTotalLength();
    monthlyPath
        .attr("stroke-dasharray", monthlyLength + " " + monthlyLength)
        .attr("stroke-dashoffset", monthlyLength)
        .transition()
        .duration(2500)
        .delay(500)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    // 添加图例
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 100}, -20)`);

    legend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke", "#0288d1")
        .attr("stroke-width", 1.5);

    legend.append("text")
        .attr("x", 25)
        .attr("y", 0)
        .attr("dy", "0.32em")
        .text("日活人数");

    legend.append("line")
        .attr("x1", 0)
        .attr("x2", 20)
        .attr("y1", 20)
        .attr("y2", 20)
        .attr("stroke", standardColors.line)
        .attr("stroke-width", 2);

    legend.append("text")
        .attr("x", 25)
        .attr("y", 20)
        .attr("dy", "0.32em")
        .text("月平均");

    // 添加交互
    const focus = g.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("circle")
        .attr("r", 4)
        .attr("fill", "#0288d1");

    focus.append("rect")
        .attr("class", "tooltip-bg")
        .attr("fill", "white")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("padding", 8);

    focus.append("text")
        .attr("x", 9)
        .attr("dy", ".35em");

    const overlay = g.append("rect")
        .attr("class", "overlay")
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .attr("width", width)
        .attr("height", height)
        .on("mouseover", () => focus.style("display", null))
        .on("mouseout", () => focus.style("display", "none"))
        .on("mousemove", mousemove);

    function mousemove(event) {
        const bisect = d3.bisector(d => new Date(d.date)).left;
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisect(dailyData, x0, 1);
        const d0 = dailyData[i - 1];
        const d1 = dailyData[i];
        const d = x0 - new Date(d0.date) > new Date(d1.date) - x0 ? d1 : d0;

        focus.attr("transform", `translate(${x(new Date(d.date))},${y(d.active_users)})`);
        focus.select("text").text(`${d.date}: ${d.active_users}人`);

        const textBox = focus.select("text").node().getBBox();
        focus.select("rect")
            .attr("x", textBox.x - 4)
            .attr("y", textBox.y - 4)
            .attr("width", textBox.width + 8)
            .attr("height", textBox.height + 8);
    }
}

// 创建日历热力图
function createCalendarHeatmap(data) {
    try {
        const container = d3.select("#calendar-heatmap");

        // 清除已有内容
        container.selectAll("*").remove();

        // 设置热力图的尺寸
        const cellSize = 30; // 增加单元格大小
        const weekDays = 7;
        const width = container.node().getBoundingClientRect().width;
        const height = cellSize * (weekDays + 3); // 增加额外空间用于标签

        // 计算左侧边距，使图表居中
        const totalCellsWidth = 24 * cellSize; // 24小时
        const margin = {
            left: Math.max((width - totalCellsWidth) / 2, 60), // 确保至少有60px的左边距
            top: 40,
            right: 60,
            bottom: 60
        };

        // 创建SVG
        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        // 创建颜色比例尺
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
            .domain([0, d3.max(data.calendar_heatmap_data, d => d.count)]);

        // 添加标题
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", totalCellsWidth / 2)
            .attr("y", -20)
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("font-weight", "bold")
            .text("24小时学习活动分布");

        // 定义星期标签的显示顺序和映射关系
        const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
        const reorderedLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
        const labelToOriginalWeekday = [1, 2, 3, 4, 5, 6, 0];

        // 添加重新排列的星期标签
        svg.selectAll(".weekday-label")
            .data(reorderedLabels)
            .enter()
            .append("text")
            .attr("class", "weekday-label")
            .attr("x", -10)
            .attr("y", (d, i) => {
                // 标签按显示顺序排列：周一在第1行，周二在第2行...周日在第7行
                return i * cellSize + cellSize / 2;
            })
            .style("text-anchor", "end")
            .style("font-size", "12px")
            .style("alignment-baseline", "middle")
            .text(d => d);

        // 添加小时标签
        const hourLabels = d3.range(24);
        svg.selectAll(".hour-label")
            .data(hourLabels)
            .enter()
            .append("text")
            .attr("class", "hour-label")
            .attr("x", (d, i) => i * cellSize + cellSize / 2)
            .attr("y", weekDays * cellSize + 20)
            .style("text-anchor", "middle")
            .style("font-size", "12px")
            .attr("transform", (d, i) => `rotate(-45, ${i * cellSize + cellSize / 2}, ${weekDays * cellSize + 20})`)
            .text(d => d + ":00");

        // 处理热力图数据 - 按原始weekday分组
        const heatmapData = d3.group(data.calendar_heatmap_data, d => d.weekday);

        // 创建热力图单元格 - 数据位置保持在原始weekday位置不变
        for (let originalWeekday = 0; originalWeekday < 7; originalWeekday++) {
            const dayData = heatmapData.get(originalWeekday) || [];

            svg.selectAll(`.day-${originalWeekday}`)
                .data(dayData)
                .enter()
                .append("rect")
                .attr("class", `day-${originalWeekday}`)
                .attr("x", d => d.hour * cellSize)
                .attr("y", originalWeekday * cellSize) // 数据保持在原始weekday位置
                .attr("width", cellSize - 2)
                .attr("height", cellSize - 2)
                .attr("rx", 2)
                .attr("ry", 2)
                .attr("fill", d => colorScale(d.count))
                .style("stroke", "#fff")
                .style("stroke-width", 2)
                .style("cursor", "pointer")
                .on("mouseover", function(event, d) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr("stroke", "#000")
                            .attr("stroke-width", 3)
                            .style("filter", "brightness(1.2)");

                        tooltip.transition()
                            .duration(200)
                            .style("opacity", .9);

                        const maxCount = d3.max(data.calendar_heatmap_data, item => item.count);
                        const percentage = ((d.count / maxCount) * 100).toFixed(1);
                        const intensity = d.count === 0 ? "无活动" :
                            d.count < maxCount * 0.3 ? "低活跃" :
                            d.count < maxCount * 0.7 ? "中活跃" : "高活跃";

                        tooltip.html(`
                                <div style="font-weight: bold; margin-bottom: 5px;">学习活动热力图</div>
                                <div><strong>时间：</strong>${d.hour}:00 - ${d.hour + 1}:00</div>

                                <div><strong>学习人次：</strong>${d.count}次</div>
                                <div><strong>活跃强度：</strong>${intensity} (${percentage}%)</div>
                                <div><strong>相对热度：</strong>${d.count === maxCount ? "最高" : `${percentage}%`}</div>
                                <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                                    颜色越深表示活跃度越高
                                </div>
                            `)
                                .style("left", (event.pageX + 10) + "px")
                                .style("top", (event.pageY - 28) + "px");
                        })
                        .on("mouseout", function() {
                            d3.select(this)
                                .transition()
                                .duration(200)
                                .attr("stroke", "#fff")
                                .attr("stroke-width", 2)
                                .style("filter", "brightness(1)");
                            
                            tooltip.transition()
                                .duration(500)
                                .style("opacity", 0);
                        });
                }

                // 添加图例 - 移到右侧
                const legendWidth = 200;
                const legendHeight = 20;
                const legend = svg.append("g")
                    .attr("transform", `translate(${totalCellsWidth + 40}, ${weekDays * cellSize / 2 - legendHeight / 2})`);

                const legendScale = d3.scaleLinear()
                    .domain(colorScale.domain())
                    .range([0, legendWidth]);

                const legendAxis = d3.axisBottom(legendScale)
                    .ticks(5);

                const legendGradient = svg.append("defs")
                    .append("linearGradient")
                    .attr("id", "legend-gradient")
                    .selectAll("stop")
                    .data(d3.ticks(0, 1, 10))
                    .enter()
                    .append("stop")
                    .attr("offset", d => d * 100 + "%")
                    .attr("stop-color", d => colorScale(d * colorScale.domain()[1]));

                legend.append("rect")
                    .attr("width", legendWidth)
                    .attr("height", legendHeight)
                    .style("fill", "url(#legend-gradient)");

                legend.append("g")
                    .attr("transform", `translate(0, ${legendHeight})`)
                    .call(legendAxis);

                legend.append("text")
                    .attr("x", legendWidth / 2)
                    .attr("y", -10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .text("学习人次");

            } catch (error) {
                console.error('热力图创建失败:', error);
            }
        }

        // 创建按小时学习分布柱状图
        function createHourBarChart(data) {
            try {
                const svg = d3.select("#hour-bar-chart");
                const margin = { top: 30, right: 30, bottom: 40, left: 50 };
                const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
                const height = +svg.attr("height") - margin.top - margin.bottom;

                // 清除已有内容
                svg.selectAll("*").remove();

                const g = svg.append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);

                // 处理数据
                const hourData = Array.from({length: 24}, (_, i) => ({
                    hour: i,
                    count: 0
                }));

                // 使用calendar_heatmap_data中的数据
                if (data && data.calendar_heatmap_data && Array.isArray(data.calendar_heatmap_data)) {
                    data.calendar_heatmap_data.forEach(d => {
                        if (d && d.hour !== undefined && d.count !== undefined) {
                            const hour = parseInt(d.hour);
                            if (!isNaN(hour) && hour >= 0 && hour < 24) {
                                hourData[hour].count += d.count;
                            }
                        }
                    });
                }

                // 创建比例尺
                const x = d3.scaleBand()
                    .domain(hourData.map(d => d.hour))
                    .range([0, width])
                    .padding(0.1);

                const y = d3.scaleLinear()
                    .domain([0, d3.max(hourData, d => d.count)])
                    .range([height, 0]);

                // 添加x轴
                g.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x).tickFormat(d => d + ":00"));

                // 添加y轴
                g.append("g")
                    .call(d3.axisLeft(y));

                // 添加坐标轴标签
                g.append("text")
                    .attr("class", "axis-label")
                    .attr("x", width / 2)
                    .attr("y", height + 50)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("小时");

                g.append("text")
                    .attr("class", "axis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -height / 2)
                    .attr("y", -margin.left + 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("学习人次");

                // 添加网格线
                g.append("g")
                    .attr("class", "grid")
                    .attr("opacity", 0.1)
                    .call(d3.axisLeft(y)
                        .tickSize(-width)
                        .tickFormat(""));

                // 添加柱状图
                const bars = g.selectAll(".bar")
                    .data(hourData)
                    .enter()
                    .append("rect")
                    .attr("class", "bar")
                    .attr("x", d => x(d.hour))
                    .attr("y", d => y(d.count))
                    .attr("width", x.bandwidth())
                    .attr("height", d => height - y(d.count))
                    .attr("fill", "#0288d1");

                // 添加拟合曲线
                const lineGenerator = d3.line()
                    .x(d => x(d.hour) + x.bandwidth() / 2)
                    .y(d => y(d.count))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                g.append("path")
                    .datum(hourData)
                    .attr("fill", "none")
                    .attr("stroke", standardColors.line)
                    .attr("stroke-width", 2)
                    .attr("d", lineGenerator);

                // 添加图例
                const legend = g.append("g")
                    .attr("class", "legend")
                    .attr("transform", `translate(${width - 100}, 0)`);

                legend.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", "#0288d1");

                legend.append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .text("实际数据");

                legend.append("line")
                    .attr("x1", 0)
                    .attr("y1", 30)
                    .attr("x2", 15)
                    .attr("y2", 30)
                    .attr("stroke", standardColors.line)
                    .attr("stroke-width", 2);

                legend.append("text")
                    .attr("x", 20)
                    .attr("y", 35)
                    .text("趋势线");

                // 添加交互
                bars.on("mouseover", function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("fill", "#026aa7")
                        .style("opacity", 0.8);
                    
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    
                    const totalCount = d3.sum(hourData, item => item.count);
                    const percentage = ((d.count / totalCount) * 100).toFixed(1);
                    const avgCount = d3.mean(hourData, item => item.count);
                    const comparison = d.count >= avgCount 
                        ? `高于平均值${(d.count - avgCount).toFixed(0)}次`
                        : `低于平均值${(avgCount - d.count).toFixed(0)}次`;
                    
                    const timeRange = d.hour < 6 ? "深夜" : 
                                    d.hour < 9 ? "早晨" :
                                    d.hour < 12 ? "上午" :
                                    d.hour < 18 ? "下午" : "晚上";
                    
                    tooltip.html(`
                        <div style="font-weight: bold; margin-bottom: 5px;">按小时学习分布</div>
                        <div><strong>时间段：</strong>${d.hour}:00 - ${d.hour + 1}:00</div>
                        <div><strong>时段分类：</strong>${timeRange}</div>
                        <div><strong>学习人次：</strong>${d.count.toLocaleString()}次</div>
                        <div><strong>占比：</strong>${percentage}%</div>
                        <div><strong>与平均值比较：</strong>${comparison}</div>
                        <div><strong>小时平均：</strong>${avgCount.toFixed(0)}次</div>
                        <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                            数据基于全年学习活动统计
                        </div>
                    `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("fill", "#0288d1")
                        .style("opacity", 1);
                    
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });

                // 添加标题
                g.append("text")
                    .attr("class", "axis-label")
                    .attr("x", width / 2)
                    .attr("y", height + margin.bottom - 5)
                    .style("text-anchor", "middle")
                    .text("小时");

                g.append("text")
                    .attr("class", "axis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -height / 2)
                    .attr("y", -margin.left + 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("学习人次");
            } catch (error) {
                console.error('小时分布图创建失败:', error);
            }
        }

        // 创建按星期学习分布柱状图
        function createWeekdayBarChart(data) {
            try {
                const svg = d3.select("#weekday-bar-chart");
                const margin = { top: 30, right: 30, bottom: 40, left: 50 };
                const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
                const height = +svg.attr("height") - margin.top - margin.bottom;

                // 清除已有内容
                svg.selectAll("*").remove();

                const g = svg.append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);

                // 处理数据 - 保持原始weekday作为数据的key
                const weekdayData = Array.from({length: 7}, (_, i) => ({
                    weekday: i, // 原始weekday：0=周日, 1=周一...6=周六
                    count: 0
                }));

                // 使用calendar_heatmap_data中的数据
                if (data && data.calendar_heatmap_data && Array.isArray(data.calendar_heatmap_data)) {
                    data.calendar_heatmap_data.forEach(d => {
                        if (d && d.weekday !== undefined && d.count !== undefined) {
                            const weekday = parseInt(d.weekday);
                            if (!isNaN(weekday) && weekday >= 0 && weekday < 7) {
                                weekdayData[weekday].count += d.count;
                            }
                        }
                    });
                }

                // 创建比例尺 - 使用原始weekday作为domain，数据位置不变
                const x = d3.scaleBand()
                    .domain(weekdayData.map(d => d.weekday)) // 保持原始domain [0,1,2,3,4,5,6]
                    .range([0, width])
                    .padding(0.1);

                const y = d3.scaleLinear()
                    .domain([0, d3.max(weekdayData, d => d.count)])
                    .range([height, 0]);

                // 定义星期标签映射
                const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
                const reorderedLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

                // 添加x轴 - 数据位置不变，只改变标签文字
                const xAxis = g.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x));

                // 手动设置X轴标签文字，让它们显示为从周一开始的顺序
                const tickTexts = xAxis.selectAll("text");
                tickTexts.each(function(d, i) {
                    // d是原始weekday值(0,1,2,3,4,5,6)
                    // 将每个位置的标签改为重新排列的显示文字
                    const newLabels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
                    d3.select(this).text(newLabels[i]);
                });

                // 添加y轴
                g.append("g")
                    .call(d3.axisLeft(y));

                // 添加坐标轴标签
                g.append("text")
                    .attr("class", "axis-label")
                    .attr("x", width / 2)
                    .attr("y", height + 50)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("星期");

                g.append("text")
                    .attr("class", "axis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -height / 2)
                    .attr("y", -margin.left + 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("学习人次");

                // 添加网格线
                g.append("g")
                    .attr("class", "grid")
                    .attr("opacity", 0.1)
                    .call(d3.axisLeft(y)
                        .tickSize(-width)
                        .tickFormat(""));

                // 添加柱状图 - 数据保持在原始weekday位置
                const bars = g.selectAll(".bar")
                    .data(weekdayData)
                    .enter()
                    .append("rect")
                    .attr("class", "bar")
                    .attr("x", d => x(d.weekday))
                    .attr("y", d => y(d.count))
                    .attr("width", x.bandwidth())
                    .attr("height", d => height - y(d.count))
                    .attr("fill", "#0288d1");

                // 添加拟合曲线
                const lineGenerator = d3.line()
                    .x(d => x(d.weekday) + x.bandwidth() / 2)
                    .y(d => y(d.count))
                    .curve(d3.curveCatmullRom.alpha(0.5));

                g.append("path")
                    .datum(weekdayData)
                    .attr("fill", "none")
                    .attr("stroke", standardColors.line)
                    .attr("stroke-width", 2)
                    .attr("d", lineGenerator);

                // 添加图例
                const legend = g.append("g")
                    .attr("class", "legend")
                    .attr("transform", `translate(${width - 100}, 0)`);

                legend.append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 15)
                    .attr("height", 15)
                    .attr("fill", "#0288d1");

                legend.append("text")
                    .attr("x", 20)
                    .attr("y", 12)
                    .text("实际数据");

                legend.append("line")
                    .attr("x1", 0)
                    .attr("y1", 30)
                    .attr("x2", 15)
                    .attr("y2", 30)
                    .attr("stroke", standardColors.line)
                    .attr("stroke-width", 2);

                legend.append("text")
                    .attr("x", 20)
                    .attr("y", 35)
                    .text("趋势线");

                // 添加交互
                bars.on("mouseover", function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("fill", "#026aa7")
                        .style("opacity", 0.8);
                    
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    
                    const totalCount = d3.sum(weekdayData, item => item.count);
                    const percentage = ((d.count / totalCount) * 100).toFixed(1);
                    const avgCount = d3.mean(weekdayData, item => item.count);
                    const comparison = d.count >= avgCount 
                        ? `高于平均值${(d.count - avgCount).toFixed(0)}次`
                        : `低于平均值${(avgCount - d.count).toFixed(0)}次`;
                    
                    // 使用原始weekday值判断工作日/周末
                    const dayType = d.weekday === 0 || d.weekday === 6 ? "周末" : "工作日";
                    const rank = weekdayData
                        .map(item => item.count)
                        .sort((a, b) => b - a)
                        .indexOf(d.count) + 1;
                    
                    tooltip.html(`
                        <div style="font-weight: bold; margin-bottom: 5px;">按星期学习分布</div>

                        <div><strong>学习人次：</strong>${d.count.toLocaleString()}次</div>
                        <div><strong>占比：</strong>${percentage}%</div>
                        <div><strong>活跃度排名：</strong>第${rank}名</div>
                        <div><strong>与平均值比较：</strong>${comparison}</div>
                        <div><strong>星期平均：</strong>${avgCount.toFixed(0)}次</div>
                        <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                            ${dayType === "周末" ? "周末学习相对较少" : "工作日学习较为活跃"}
                        </div>
                    `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("fill", "#0288d1")
                        .style("opacity", 1);
                    
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });

                // 添加标题
                g.append("text")
                    .attr("class", "axis-label")
                    .attr("x", width / 2)
                    .attr("y", height + margin.bottom - 5)
                    .style("text-anchor", "middle")
                    .text("星期");

                g.append("text")
                    .attr("class", "axis-label")
                    .attr("transform", "rotate(-90)")
                    .attr("x", -height / 2)
                    .attr("y", -margin.left + 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "12px")
                    .style("fill", "#666")
                    .text("学习人次");
            } catch (error) {
                console.error('星期分布图创建失败:', error);
            }
        }