import { Typography, Card, Grid, Statistic } from "@arco-design/web-react";

const { Title, Paragraph } = Typography;
const { Row, Col } = Grid;

export default function HomePage() {
  return (
    <div>
      <Typography style={{ textAlign: "center", marginBottom: 48 }}>
        <Title heading={2}>ETL Online Judge</Title>
        <Paragraph type="secondary" style={{ fontSize: 16 }}>
          算法竞赛练习平台 —— 练习、比赛、提升
        </Paragraph>
      </Typography>

      <Row gutter={24}>
        <Col span={8}>
          <Card hoverable>
            <Statistic title="题目总数" value={0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable>
            <Statistic title="提交总数" value={0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card hoverable>
            <Statistic title="用户总数" value={0} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
