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

// 加载数据并初始化图表
d3.json("../../data/quality_efficiency.json").then(data => {
    console.log("加载的数据:", data);

    // 更新KPI指标
    updateKPIs(data);

    // 创建图表
    createCompletionHistogram(data);
    createCompletionBoxplot(data);
    createCompletionScatter(data);
    createEfficiencyRadar(data);
    createIntervalPatternAnalysis(data);
});

// 更新KPI指标
function updateKPIs(data) {
    // 更新平均完成度
    document.getElementById("completion-rate").textContent =
        (data.average_completion_rate * 100).toFixed(1) + "%";

    // 更新高完成记录占比
    document.getElementById("high-completion-ratio").textContent =
        (data.high_completion_record_ratio * 100).toFixed(1) + "%";

    // 更新放弃率
    document.getElementById("abandonment-rate").textContent =
        (data.abandonment_rate * 100).toFixed(1) + "%";

    // 更新平均学习时长
    document.getElementById("avg-duration").textContent =
        data.average_duration_per_study_session.toFixed(2) + "小时";

    // 更新平均学习间隔
    document.getElementById("avg-interval").textContent =
        data.average_learning_interval_hours.toFixed(1) + "小时";
}

// 创建完成度分布直方图
function createCompletionHistogram(data) {
    const svg = d3.select("#completion-histogram");
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 400;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 处理数据
    const histogramData = Object.entries(data.completion_histogram).map(([range, count]) => {
        const [start, end] = range.split('-').map(Number);
        return {
            bin_start: start,
            bin_end: end,
            count: count,
            percentage: count / d3.sum(Object.values(data.completion_histogram)) * 100
        };
    });

    // 创建比例尺
    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(histogramData, d => d.count)])
        .range([height - margin.top - margin.bottom, 0]);

    // 添加x轴
    g.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => (d * 100) + "%"));

    // 添加y轴
    g.append("g")
        .call(d3.axisLeft(y));

    // 添加柱状图
    const bars = g.selectAll("rect")
        .data(histogramData)
        .enter()
        .append("rect")
        .attr("x", d => x(d.bin_start))
        .attr("y", height - margin.top - margin.bottom) // 初始位置在底部
        .attr("width", d => x(d.bin_end) - x(d.bin_start))
        .attr("height", 0) // 初始高度为0
        .attr("fill", standardColors.primary[0])
        .attr("opacity", 0.8);

    // 添加动画效果
    bars.transition()
        .duration(800)
        .delay((d, i) => i * 100) // 每个柱子延迟100ms
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr("y", d => y(d.count))
        .attr("height", d => height - margin.top - margin.bottom - y(d.count));

    // 添加交互效果
    bars.on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        完成度区间: ${(d.bin_start * 100).toFixed(0)}%-${(d.bin_end * 100).toFixed(0)}%<br>
                        学习人员数量: ${d.count}<br>
                        占比: ${d.percentage.toFixed(1)}%
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.8);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top + 10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("完成度");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("学习人员数量");
}

// 创建完成度箱线图
function createCompletionBoxplot(data) {
    const svg = d3.select("#demographic-boxplot");
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 500;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 处理数据
    const features = ["age", "work_experience", "study_duration"];
    const featureNames = {
        "age": "年龄",
        "work_experience": "工作年限",
        "study_duration": "学习时长"
    };

    // 找出所有特征的最大值作为y轴范围
    let maxValue = 0;
    try {
        for (const feature of features) {
            const highValues = data.box_plot_data ?.high_completion_group ?.[feature] || [];
            const lowValues = data.box_plot_data ?.low_completion_group ?.[feature] || [];

            if (Array.isArray(highValues) && highValues.length > 0) {
                const validHighValues = highValues.filter(v => typeof v === 'number' && !isNaN(v));
                if (validHighValues.length > 0) {
                    const highMax = Math.max(...validHighValues);
                    if (highMax > maxValue) maxValue = highMax;
                }
            }

            if (Array.isArray(lowValues) && lowValues.length > 0) {
                const validLowValues = lowValues.filter(v => typeof v === 'number' && !isNaN(v));
                if (validLowValues.length > 0) {
                    const lowMax = Math.max(...validLowValues);
                    if (lowMax > maxValue) maxValue = lowMax;
                }
            }
        }
    } catch (error) {
        console.error('Error processing data:', error);
        maxValue = 100;
    }

    // 创建比例尺
    const x = d3.scaleBand()
        .domain(features)
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, maxValue || 100])
        .range([height - margin.top - margin.bottom, 0]);

    // 添加x轴
    g.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d => featureNames[d]));

    // 添加y轴
    g.append("g")
        .call(d3.axisLeft(y));

    // 绘制箱线图
    for (const feature of features) {
        try {
            const highData = Array.isArray(data.box_plot_data ?.high_completion_group ?.[feature]) ?
                data.box_plot_data.high_completion_group[feature].filter(v => typeof v === 'number' && !isNaN(v)) : [];
            const lowData = Array.isArray(data.box_plot_data ?.low_completion_group ?.[feature]) ?
                data.box_plot_data.low_completion_group[feature].filter(v => typeof v === 'number' && !isNaN(v)) : [];

            if (highData.length > 0) {
                const highStats = calculateBoxPlotStats(highData);
                drawBoxPlot(g, highStats, x(feature), x.bandwidth() / 2, y, standardColors.primary[0], "高完成度组");
            }

            if (lowData.length > 0) {
                const lowStats = calculateBoxPlotStats(lowData);
                drawBoxPlot(g, lowStats, x(feature) + x.bandwidth() / 2, x.bandwidth() / 2, y, standardColors.primary[1], "低完成度组");
            }
        } catch (error) {
            console.error(`Error processing feature ${feature}:`, error);
        }
    }

    // 添加图例
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - margin.left - margin.right - 100}, 0)`);

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", standardColors.primary[0])
        .attr("opacity", 0.6);

    legend.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .text("高完成度组");

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", standardColors.primary[1])
        .attr("opacity", 0.6);

    legend.append("text")
        .attr("x", 20)
        .attr("y", 32)
        .text("低完成度组");
}

// 计算箱线图统计数据
function calculateBoxPlotStats(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }

    const sortedValues = values.filter(v => typeof v === 'number' && !isNaN(v))
        .sort((a, b) => a - b);

    if (sortedValues.length === 0) {
        return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }

    return {
        min: sortedValues[0],
        q1: d3.quantile(sortedValues, 0.25),
        median: d3.median(sortedValues),
        q3: d3.quantile(sortedValues, 0.75),
        max: sortedValues[sortedValues.length - 1]
    };
}

// 绘制单个箱线图
function drawBoxPlot(g, data, x, width, y, color, label) {
    // 绘制箱体
    g.append("rect")
        .attr("x", x)
        .attr("y", y(data.q3))
        .attr("width", width)
        .attr("height", y(data.q1) - y(data.q3))
        .attr("fill", color)
        .attr("opacity", 0.6)
        .on("mouseover", function(event) {
            d3.select(this).attr("opacity", 0.8);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        ${label}<br>
                        最大值: ${data.max.toFixed(2)}<br>
                        上四分位: ${data.q3.toFixed(2)}<br>
                        中位数: ${data.median.toFixed(2)}<br>
                        下四分位: ${data.q1.toFixed(2)}<br>
                        最小值: ${data.min.toFixed(2)}
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.6);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 绘制中位线
    g.append("line")
        .attr("x1", x)
        .attr("x2", x + width)
        .attr("y1", y(data.median))
        .attr("y2", y(data.median))
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    // 绘制须线
    g.append("line")
        .attr("x1", x + width / 2)
        .attr("x2", x + width / 2)
        .attr("y1", y(data.min))
        .attr("y2", y(data.q1))
        .attr("stroke", color)
        .attr("stroke-width", 2);

    g.append("line")
        .attr("x1", x + width / 2)
        .attr("x2", x + width / 2)
        .attr("y1", y(data.q3))
        .attr("y2", y(data.max))
        .attr("stroke", color)
        .attr("stroke-width", 2);

    // 绘制须线端点
    g.append("line")
        .attr("x1", x)
        .attr("x2", x + width)
        .attr("y1", y(data.min))
        .attr("y2", y(data.min))
        .attr("stroke", color)
        .attr("stroke-width", 2);

    g.append("line")
        .attr("x1", x)
        .attr("x2", x + width)
        .attr("y1", y(data.max))
        .attr("y2", y(data.max))
        .attr("stroke", color)
        .attr("stroke-width", 2);
}

// 创建完成度与课程时长散点图
function createCompletionScatter(data) {
    const svg = d3.select("#time-completion-scatter");
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 400;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 处理数据，随机采样以提高性能
    const scatterData = data.completion_vs_course_duration_scatter || [];
    const sampleSize = Math.min(scatterData.length, 5000); // 最多显示5000个点
    const sampledData = [];

    if (scatterData.length > 0) {
        const step = Math.floor(scatterData.length / sampleSize);
        for (let i = 0; i < scatterData.length; i += step) {
            const d = scatterData[i];
            if (d && typeof d['学习完成度'] === 'number' && typeof d['课程时长(小时)'] === 'number') {
                sampledData.push({
                    completion: d['学习完成度'],
                    duration: d['课程时长(小时)']
                });
            }
        }
    }



    // 创建比例尺
    const x = d3.scaleLinear()
        .domain([0, d3.max(sampledData, d => d.duration)])
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(sampledData, d => d.completion)])
        .range([height - margin.top - margin.bottom, 0]);

    // 添加x轴
    g.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x));

    // 添加y轴
    g.append("g")
        .call(d3.axisLeft(y).tickFormat(d => (d * 100) + "%"));

    // 添加散点
    const circles = g.selectAll("circle")
        .data(sampledData)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.duration))
        .attr("cy", d => y(d.completion))
        .attr("r", 0) // 初始半径为0
        .attr("fill", standardColors.primary[0])
        .attr("opacity", 0) // 初始透明度为0
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("r", 4)
                .attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        课程时长：${d.duration.toFixed(2)}小时<br>
                        完成度：${(d.completion * 100).toFixed(1)}%
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("r", 2)
                .attr("opacity", 0.4);

            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 添加散点入场动画
    circles.transition()
        .duration(800)
        .delay((d, i) => Math.min(i * 2, 1000)) // 最多延迟1秒
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr("r", 2)
        .attr("opacity", 0.4);

    // 计算并绘制趋势线
    if (sampledData.length > 1) {
        const xValues = sampledData.map(d => d.duration);
        const yValues = sampledData.map(d => d.completion);

        const xMean = d3.mean(xValues);
        const yMean = d3.mean(yValues);

        const ssxy = d3.sum(xValues.map((x, i) => (x - xMean) * (yValues[i] - yMean)));
        const ssxx = d3.sum(xValues.map(x => (x - xMean) * (x - xMean)));

        if (ssxx !== 0) {
            const slope = ssxy / ssxx;
            const intercept = yMean - slope * xMean;

            const x1 = d3.min(xValues);
            const x2 = d3.max(xValues);
            const y1 = slope * x1 + intercept;
            const y2 = slope * x2 + intercept;

            // 添加带动画效果的拟合线
            const trendLine = g.append("line")
                .attr("class", "trend-line")
                .attr("x1", x(x1))
                .attr("y1", y(y1))
                .attr("x2", x(x1)) // 初始时x2等于x1，形成一个点
                .attr("y2", y(y1)) // 初始时y2等于y1，形成一个点
                .attr("stroke", standardColors.line)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5")
                .attr("opacity", 0);

            // 添加线条延伸动画
            trendLine.transition()
                .delay(1200) // 在散点动画完成后开始
                .duration(1000)
                .ease(d3.easeQuadOut)
                .attr("x2", x(x2))
                .attr("y2", y(y2))
                .attr("opacity", 1);
        }
    }

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top + 10)
        .attr("text-anchor", "middle")
        .text("课程时长（小时）");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("完成度");

    // 添加图例
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - margin.left - margin.right - 120}, 20)`);

    // 散点图例
    const scatterLegend = legend.append("g");

    scatterLegend.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 3)
        .attr("fill", standardColors.primary[0])
        .attr("opacity", 0.6);

    scatterLegend.append("text")
        .attr("x", 10)
        .attr("y", 4)
        .style("font-size", "12px")
        .style("fill", "#333")
        .text("学习记录");

    // 拟合线图例
    if (sampledData.length > 1) {
        const trendLegend = legend.append("g")
            .attr("transform", "translate(0, 20)");

        trendLegend.append("line")
            .attr("x1", -5)
            .attr("y1", 0)
            .attr("x2", 10)
            .attr("y2", 0)
            .attr("stroke", standardColors.line)
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5");

        trendLegend.append("text")
            .attr("x", 15)
            .attr("y", 4)
            .style("font-size", "12px")
            .style("fill", "#333")
            .text("拟合线");
    }
}

// 创建学习效率综合评估雷达图
function createEfficiencyRadar(data) {
    const svg = d3.select("#efficiency-radar");
    const width = +svg.node().getBoundingClientRect().width;
    const height = 500;
    const margin = { top: 50, right: 50, bottom: 50, left: 50 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2 - 30;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // 雷达图数据
    const metrics = [
        { name: "完成率", value: data.average_completion_rate, max: 1 },
        { name: "高完成记录占比", value: data.high_completion_record_ratio, max: 1 },
        { name: "持续性", value: 1 - data.abandonment_rate, max: 1 },
        { name: "学习强度", value: Math.min(data.average_duration_per_study_session / 2, 1), max: 1 },
        { name: "学习频率", value: Math.min(48 / data.average_learning_interval_hours, 1), max: 1 }
    ];

    const angleSlice = Math.PI * 2 / metrics.length;

    // 创建径向比例尺
    const rScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, radius]);

    // 绘制同心圆
    const levels = 5;
    for (let i = 1; i <= levels; i++) {
        g.append("circle")
            .attr("r", rScale(i / levels))
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.5);
    }

    // 绘制轴线
    metrics.forEach((metric, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const x = rScale(1) * Math.cos(angle);
        const y = rScale(1) * Math.sin(angle);

        g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", x)
            .attr("y2", y)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1);

        // 添加标签
        const labelX = rScale(1.15) * Math.cos(angle);
        const labelY = rScale(1.15) * Math.sin(angle);

        g.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "12px")
            .text(metric.name);
    });

    // 创建雷达图形状
    const lineGenerator = d3.lineRadial()
        .angle((d, i) => angleSlice * i)
        .radius(d => rScale(d.value))
        .curve(d3.curveLinearClosed);

    g.append("path")
        .datum(metrics)
        .attr("d", lineGenerator)
        .attr("fill", standardColors.primary[0])
        .attr("fill-opacity", 0.2)
        .attr("stroke", standardColors.primary[0])
        .attr("stroke-width", 2);

    // 添加数据点
    metrics.forEach((metric, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const x = rScale(metric.value) * Math.cos(angle);
        const y = rScale(metric.value) * Math.sin(angle);

        g.append("circle")
            .attr("cx", x)
            .attr("cy", y)
            .attr("r", 4)
            .attr("fill", standardColors.primary[0])
            .on("mouseover", function(event) {
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                tooltip.html(`
                            ${metric.name}<br>
                            数值: ${(metric.value * 100).toFixed(1)}%
                        `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    });
}

// 创建学习行为模式分析
function createIntervalPatternAnalysis(data) {
    const svg = d3.select("#interval-pattern-analysis");
    const margin = { top: 40, right: 80, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 500;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const intervalData = data.user_learning_intervals_raw || {};
    const intervalValues = Object.values(intervalData).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);



    // 按间隔时间分组
    const groups = [
        { name: "高频学习(≤12小时)", min: 0, max: 12 },
        { name: "日常学习(12-48小时)", min: 12, max: 48 },
        { name: "周期学习(48-168小时)", min: 48, max: 168 },
        { name: "间歇学习(>168小时)", min: 168, max: Infinity }
    ];

    const groupStats = groups.map(group => {
        const values = intervalValues.filter(v => v > group.min && v <= group.max);
        return {
            ...group,
            count: values.length,
            percentage: values.length / intervalValues.length * 100,
            avgInterval: values.length > 0 ? d3.mean(values) : 0
        };
    });

    // 创建比例尺
    const x = d3.scaleBand()
        .domain(groupStats.map(d => d.name))
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(groupStats, d => d.count)])
        .range([height - margin.top - margin.bottom, 0]);

    // 添加坐标轴
    g.append("g")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-25)");

    g.append("g")
        .call(d3.axisLeft(y));

    // 绘制柱状图
    g.selectAll("rect")
        .data(groupStats)
        .enter()
        .append("rect")
        .attr("x", d => x(d.name))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => height - margin.top - margin.bottom - y(d.count))
        .attr("fill", standardColors.primary[0])
        .attr("opacity", 0.8)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        ${d.name}<br>
                        学习人员数量: ${d.count}<br>
                        占比: ${d.percentage.toFixed(1)}%<br>
                        平均间隔: ${d.avgInterval.toFixed(1)}小时
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.8);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 添加百分比标签
    g.selectAll(".percentage-label")
        .data(groupStats)
        .enter()
        .append("text")
        .attr("class", "percentage-label")
        .attr("x", d => x(d.name) + x.bandwidth() / 2)
        .attr("y", d => y(d.count) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text(d => d.percentage.toFixed(1) + "%");

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top + 10)
        .attr("text-anchor", "middle")
        .text("学习行为类型");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .text("学习人员数量");
}

