import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Grid,
  GridItem,
  Heading,
  Image,
  Skeleton,
  Spacer,
  Stack,
  Text,
} from '@chakra-ui/react';
export const AuctionHouseCardSkeleton = ({
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
        <Skeleton>
          <Image src={image} minHeight={100}></Image>
        </Skeleton>
      </CardHeader>
      <CardBody>
        <Stack direction="row">
          <Skeleton>
            <Heading>{name}</Heading>
          </Skeleton>
          <Spacer />
        </Stack>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(4, 1fr)' }} gap={1}>
          <GridItem>
            <Skeleton>
              <Text>AGI: +{agi} </Text>
            </Skeleton>
          </GridItem>
          <GridItem>
            <Skeleton>
              <Text>INT: +{int} </Text>
            </Skeleton>
          </GridItem>
          <GridItem>
            <Skeleton>
              <Text>HIT +{hit} </Text>
            </Skeleton>
          </GridItem>
          <GridItem>
            <Skeleton>
              <Text>STR: +{str} </Text>
            </Skeleton>
          </GridItem>
        </Grid>
      </CardBody>

      <CardFooter></CardFooter>
    </Card>
  );
};
