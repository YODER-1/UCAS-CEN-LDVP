// 创建tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// 当前选中的维度
let currentDimension = "gender";
// 全局数据变量
let data;

// 颜色方案
const colors = {
    stacked: ["#0288d1", "#ff9800"],
    grouped: ["#0288d1", "#ff9800", "#f44336", "#4caf50"],
    radar: ["#0288d1", "#ff9800", "#f44336", "#4caf50", "#9c27b0", "#00bcd4", "#8bc34a", "#ffc107"],
    pie: ["#0288d1", "#ff9800", "#f44336", "#4caf50", "#9c27b0", "#00bcd4", "#8bc34a", "#ffc107"],
    heatmap: d3.interpolateBlues
};


function midAngle(d) {
    return d.startAngle + (d.endAngle - d.startAngle) / 2;
}


function sortRankData(rankData) {
    const rankOrder = {
        "初级及以下": 1,
        "中级": 2,
        "副高级": 3,
        "正高级": 4
    };

    return [...rankData].sort((a, b) => {
        const orderA = rankOrder[a["职级"]] || 999;
        const orderB = rankOrder[b["职级"]] || 999;
        return orderA - orderB;
    });
}

// 获取当前维度的数据
function getCurrentDimensionData() {
    switch (currentDimension) {
        case "gender":
            return data.gender_analysis;
        case "age":
            return data.age_groups;
        case "rank":
            return sortRankData(data.rank_analysis);
        default:
            return [];
    }
}

// 获取维度标签
function getDimensionLabel(d) {
    switch (currentDimension) {
        case "gender":
            return d["性别"];
        case "age":
            return d["年龄段"];
        case "rank":
            return d["职级"];
        default:
            return "";
    }
}

// 获取维度对应的坐标轴标签
function getDimensionAxisLabel() {
    switch (currentDimension) {
        case "age":
            return "年龄组";
        case "work_experience":
            return "工作经验";
        case "study_duration":
            return "学习时长分组";
        default:
            return "分组";
    }
}


d3.json("../../data/demographic_analysis.json").then(response => {
    // 将数据保存到全局变量
    data = response;
    // 处理年龄数据，将其分组
    data.age_groups = processAgeGroups(data.age_analysis);

    createStackedBarChart(data);
    createQualityMetricsChart(data);
    createQuantityMetricsChart(data);
    createPieChart(data);
    createRadarChart(data);

    // 更新所有图表
    updateAllCharts();
});

// 处理年龄分组
function processAgeGroups(ageData) {
    const groups = {
        "25岁以下": [],
        "26-35岁": [],
        "36-45岁": [],
        "46-55岁": [],
        "56-65岁": [],
        "66岁以上": []
    };

    ageData.forEach(d => {
        const age = d["年龄(岁)"];
        if (age <= 25) groups["25岁以下"].push(d);
        else if (age <= 35) groups["26-35岁"].push(d);
        else if (age <= 45) groups["36-45岁"].push(d);
        else if (age <= 55) groups["46-55岁"].push(d);
        else if (age <= 65) groups["56-65岁"].push(d);
        else groups["66岁以上"].push(d);
    });

    // 计算每个组的平均值
    return Object.entries(groups).map(([key, values]) => {
        if (values.length === 0) return null;

        return {
            "年龄段": key,
            "总选课人数": d3.sum(values, d => d["总选课人数"]),
            "实际学习人数": d3.sum(values, d => d["实际学习人数"]),
            "群体学习参与率": d3.mean(values, d => d["群体学习参与率"]),
            "人均学习课程数": d3.mean(values, d => d["人均学习课程数"]),
            "人均学习时长": d3.mean(values, d => d["人均学习时长"]),
            "学习完成度均值": d3.mean(values, d => d["学习完成度均值"]),
            "课程覆盖度": d3.mean(values, d => d["课程覆盖度"] || 0)
        };
    }).filter(d => d !== null);
}

// 更新所有图表
function updateAllCharts() {
    // 清除所有旧的图表元素
    d3.select("#stacked-bar-chart").selectAll("*").remove();
    d3.select("#quality-metrics-chart").selectAll("*").remove();
    d3.select("#quantity-metrics-chart").selectAll("*").remove();
    d3.select("#pie-chart").selectAll("*").remove();

    // 重新创建图表
    createStackedBarChart(data);
    createQualityMetricsChart(data);
    createQuantityMetricsChart(data);
    createPieChart(data);
    createRadarChart(data);
}

// 维度按钮事件监听
document.querySelectorAll('.dimension-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.dimension-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentDimension = this.dataset.dimension;
        updateAllCharts();
    });
});

// 创建堆叠柱状图
function createStackedBarChart(data) {
    const svg = d3.select("#stacked-bar-chart");
    const margin = { top: 40, right: 100, bottom: 40, left: 60 };
    const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;

    // 清除已有内容
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 获取当前维度的数据
    const currentData = getCurrentDimensionData();

    // 准备堆叠数据
    const stackedData = currentData.map(d => ({
        category: getDimensionLabel(d),
        "实际学习人数": d["实际学习人数"],
        "选课未学习人数": d["总选课人数"] - d["实际学习人数"]
    }));

    const stack = d3.stack()
        .keys(["实际学习人数", "选课未学习人数"]);

    const series = stack(stackedData);

    // 创建比例尺
    const x = d3.scaleBand()
        .domain(stackedData.map(d => d.category))
        .range([0, width])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(stackedData, d => d["实际学习人数"] + d["选课未学习人数"])])
        .range([height, 0]);

    // 添加坐标轴
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text(getDimensionAxisLabel());

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("人数");

    // 添加堆叠柱状图
    const groups = g.selectAll(".stack-group")
        .data(series)
        .enter().append("g")
        .attr("class", "stack-group")
        .attr("fill", (d, i) => colors.stacked[i]);

    groups.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.category))
        .attr("y", height)
        .attr("height", 0)
        .attr("width", x.bandwidth())
        .transition()
        .duration(800)
        .delay((d, i) => i * 100) // 添加延迟，使动画错开
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]));

    // 添加交互效果
    groups.selectAll("rect")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.7);

            const category = d.data.category;
            const value = d[1] - d[0];
            const type = d3.select(this.parentNode).datum().key;
            const total = d.data["实际学习人数"] + d.data["选课未学习人数"];

            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`
                        <div style="font-weight: bold; margin-bottom: 5px;">${category}</div>
                        <div>${type}: ${value.toLocaleString()}人</div>
                        <div>占比: ${((value / total) * 100).toFixed(1)}%</div>
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // 添加标题动画
    g.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("opacity", 0)
        .text("群体构成与学习状态")
        .transition()
        .duration(500)
        .style("opacity", 1);

    // 添加坐标轴动画
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .style("opacity", 0)
        .call(d3.axisBottom(x))
        .transition()
        .duration(500)
        .style("opacity", 1);

    g.append("g")
        .style("opacity", 0)
        .call(d3.axisLeft(y))
        .transition()
        .duration(500)
        .style("opacity", 1);
}

// 创建饼图
function createPieChart(data) {
    const svg = d3.select("#pie-chart");
    const width = svg.node().getBoundingClientRect().width;
    const height = +svg.attr("height");
    const margin = { top: 50, right: 80, bottom: 50, left: 80 }; // 增加左右边距
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2.5; // 减小半径，为标签预留空间

    // 清除已有内容
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // 获取当前维度的数据
    const currentData = getCurrentDimensionData();



    // 准备饼图数据
    const pieData = currentData.map(d => ({
        category: getDimensionLabel(d),
        value: d["总选课人数"] || d["实际学习人数"] || 0
    })).filter(d => d.value > 0);



    // 创建饼图生成器
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.3)
        .outerRadius(radius * 0.8)
        .cornerRadius(1);

    const outerArc = d3.arc()
        .innerRadius(radius * 0.9)
        .outerRadius(radius * 0.9);

    // 添加路径
    const arcs = g.selectAll(".arc")
        .data(pie(pieData))
        .enter().append("g")
        .attr("class", "arc");

    arcs.append("path")
        .attr("d", arc)
        .style("fill", (d, i) => colors.pie[i % colors.pie.length])
        .style("stroke", "white")
        .style("stroke-width", 2);

    // 添加标签
    const labels = arcs.append("g")
        .attr("class", "pie-label");

    // 添加交互效果
    arcs.on("mouseover", function(event, d) {
            const path = d3.select(this).select("path");
            path.transition().duration(200)
                .attr("d", d3.arc()
                    .innerRadius(radius * 0.25)
                    .outerRadius(radius * 0.85)
                    .cornerRadius(1));

            tooltip.transition().duration(200).style("opacity", .9);

            const percentage = (d.endAngle - d.startAngle) / (2 * Math.PI) * 100;
            tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 5px;">${d.data.category}</div>
                    <div>人数: ${d.data.value.toLocaleString()}</div>
                    <div>占比: ${percentage.toFixed(1)}%</div>
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            const path = d3.select(this).select("path");
            path.transition().duration(200).attr("d", arc);

            tooltip.transition().duration(500).style("opacity", 0);
        });

    // 优化饼图标签布局，解决遮挡问题
    const labelRadius = radius * 1.3; // 调整标签半径以适应新的饼图大小

    // 重新计算标签位置，避免重叠
    const labelData = pie(pieData);
    const labelPositions = [];

    labelData.forEach((d, i) => {
        const angle = midAngle(d);
        const x = Math.cos(angle - Math.PI / 2) * labelRadius;
        const y = Math.sin(angle - Math.PI / 2) * labelRadius;

        labelPositions.push({
            data: d,
            x: x,
            y: y,
            angle: angle
        });
    });

    // 调整重叠的标签位置
    for (let i = 0; i < labelPositions.length; i++) {
        for (let j = i + 1; j < labelPositions.length; j++) {
            const pos1 = labelPositions[i];
            const pos2 = labelPositions[j];
            const distance = Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));

            if (distance < 25) {
                const offset = 10;
                if (pos1.y < pos2.y) {
                    pos1.y -= offset;
                    pos2.y += offset;
                } else {
                    pos1.y += offset;
                    pos2.y -= offset;
                }
            }
        }
    }

    // 清除之前的标签
    labels.selectAll("*").remove();

    // 添加优化后的连接线
    labels.selectAll("polyline")
        .data(labelPositions)
        .enter()
        .append("polyline")
        .attr("points", d => {
            const centroid = arc.centroid(d.data);
            return [centroid, [d.x * 0.9, d.y * 0.9],
                [d.x, d.y]
            ];
        })
        .style("fill", "none")
        .style("stroke", "#999")
        .style("stroke-width", 1);

    // 添加优化后的文本标签
    labels.selectAll("text")
        .data(labelPositions)
        .enter()
        .append("text")
        .attr("transform", d => `translate(${d.x}, ${d.y})`)
        .attr("dy", ".35em")
        .style("text-anchor", d => d.angle < Math.PI ? "start" : "end")
        .style("font-size", "11px")
        .text(d => {
            const percentage = ((d.data.endAngle - d.data.startAngle) / (2 * Math.PI) * 100).toFixed(1);
            return `${d.data.data.category} (${percentage}%)`;
        });

    // 添加标题
    svg.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
}



// 创建学习质量指标分组柱状图
function createQualityMetricsChart(data) {
    const svg = d3.select("#quality-metrics-chart");
    const margin = { top: 40, right: 100, bottom: 40, left: 60 };
    const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;

    // 清除已有内容
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 获取当前维度的数据
    const currentData = getCurrentDimensionData();

    // 准备分组数据
    const metrics = ["群体学习参与率", "学习完成度均值"];
    const colors_quality = ["#0288d1", "#ff9800"];

    const groupedData = currentData.map(d => ({
        category: getDimensionLabel(d),
        values: metrics.map((metric, i) => ({
            metric: metric,
            value: d[metric] || 0,
            color: colors_quality[i]
        }))
    }));

    // 更新比例尺
    const x0 = d3.scaleBand()
        .domain(groupedData.map(d => d.category))
        .range([0, width])
        .padding(0.1);

    const x1 = d3.scaleBand()
        .domain(metrics)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const y = d3.scaleLinear()
        .domain([0, d3.max(groupedData, d => d3.max(d.values, v => v.value))])
        .range([height, 0]);

    // 添加坐标轴
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0));

    g.append("g")
        .call(d3.axisLeft(y).tickFormat(d => {
            if (d <= 1) {
                return (d * 100).toFixed(0) + "%";
            } else {
                return d.toFixed(1);
            }
        }));

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text(getDimensionAxisLabel());

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("质量指标值");

    // 创建分组柱状图
    const groups = g.selectAll(".bar-group")
        .data(groupedData)
        .enter().append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${x0(d.category)},0)`);

    // 添加柱状图动画
    groups.selectAll("rect")
        .data(d => d.values)
        .enter().append("rect")
        .attr("x", d => x1(d.metric))
        .attr("y", height)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("fill", d => d.color)
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    // 添加交互效果
    groups.selectAll("rect")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.7);

            tooltip.transition().duration(200).style("opacity", .9);

            let displayValue = d.value.toFixed(2);
            let unit = "";

            if (d.metric === "群体学习参与率" || d.metric === "学习完成度均值") {
                displayValue = (d.value * 100).toFixed(1);
                unit = "%";
            } else if (d.metric === "课程覆盖度") {
                displayValue = d.value.toFixed(2);
                unit = "门/人";
            }

            tooltip.html(`
                        <div style="font-weight: bold;">${d.metric}</div>
                        <div>数值: ${displayValue}${unit}</div>
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });
}

// 创建学习量化指标分组柱状图
function createQuantityMetricsChart(data) {
    const svg = d3.select("#quantity-metrics-chart");
    const margin = { top: 40, right: 100, bottom: 40, left: 60 };
    const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = +svg.attr("height") - margin.top - margin.bottom;

    // 清除已有内容
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 获取当前维度的数据
    const currentData = getCurrentDimensionData();

    // 准备分组数据
    const metrics = ["人均学习时长", "人均学习课程数", "课程覆盖度"];
    const colors_quantity = ["#0288d1", "#ff9800", "#f44336"];

    const groupedData = currentData.map(d => ({
        category: getDimensionLabel(d),
        values: metrics.map((metric, i) => ({
            metric: metric,
            value: d[metric] || 0,
            color: colors_quantity[i]
        }))
    }));

    // 更新比例尺
    const x0 = d3.scaleBand()
        .domain(groupedData.map(d => d.category))
        .range([0, width])
        .padding(0.1);

    const x1 = d3.scaleBand()
        .domain(metrics)
        .range([0, x0.bandwidth()])
        .padding(0.05);

    const y = d3.scaleLinear()
        .domain([0, d3.max(groupedData, d => d3.max(d.values, v => v.value))])
        .range([height, 0]);

    // 添加坐标轴
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0));

    g.append("g")
        .call(d3.axisLeft(y).tickFormat(d => d.toFixed(1)));

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text(getDimensionAxisLabel());

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("数量指标值");

    // 创建分组柱状图
    const groups = g.selectAll(".bar-group")
        .data(groupedData)
        .enter().append("g")
        .attr("class", "bar-group")
        .attr("transform", d => `translate(${x0(d.category)},0)`);

    // 添加柱状图动画
    groups.selectAll("rect")
        .data(d => d.values)
        .enter().append("rect")
        .attr("x", d => x1(d.metric))
        .attr("y", height)
        .attr("width", x1.bandwidth())
        .attr("height", 0)
        .attr("fill", d => d.color)
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .attr("y", d => y(d.value))
        .attr("height", d => height - y(d.value));

    // 添加交互效果
    groups.selectAll("rect")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.7);

            tooltip.transition().duration(200).style("opacity", .9);

            let displayValue = d.value.toFixed(2);
            let unit = "";

            if (d.metric === "人均学习时长") {
                displayValue = d.value.toFixed(1);
                unit = "小时";
            } else if (d.metric === "人均学习课程数") {
                displayValue = d.value.toFixed(1);
                unit = "门课程";
            } else if (d.metric === "课程覆盖度") {
                displayValue = d.value.toFixed(2);
                unit = "门/人";
            }

            tooltip.html(`
                        <div style="font-weight: bold;">${d.metric}</div>
                        <div>数值: ${displayValue}${unit}</div>
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 1);
            tooltip.transition().duration(500).style("opacity", 0);
        });
}