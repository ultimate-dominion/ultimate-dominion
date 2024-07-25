import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Grid,
  GridItem,
  Heading,
  Image,
  Spacer,
  Stack,
  Text,
} from '@chakra-ui/react';
export const AuctionHouseCard = ({
  name,
  image,
  agi,
  int,
  hit,
  str,
}: {
  name: string;
  image: string;
  agi: string;
  int: string;
  hit: string;
  str: string;
}): JSX.Element => {
  return (
    <Card mb={5} borderRadius={2} border="solid">
      <CardHeader>
        <Image src={image}></Image>
      </CardHeader>
      <CardBody>
        <Stack direction="row">
          <Heading>{name}</Heading>
          <Spacer />
        </Stack>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(4, 1fr)' }}>
          <GridItem>
            <Text>AGI: +{agi} </Text>
          </GridItem>
          <GridItem>
            <Text>INT: +{int} </Text>
          </GridItem>
          <GridItem>
            <Text>HIT +{hit} </Text>
          </GridItem>
          <GridItem>
            <Text>STR: +{str} </Text>
          </GridItem>
        </Grid>
      </CardBody>

      <CardFooter></CardFooter>
    </Card>
  );
};
