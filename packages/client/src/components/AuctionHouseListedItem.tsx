import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Heading,
  Spacer,
  Stack,
  Text,
} from '@chakra-ui/react';
export const AuctionHouseListedItem = ({
  name,
  buyer,
  price,
}: {
  name: string;
  buyer: string;
  price: string;
}): JSX.Element => {
  return (
    <Card mb={5} borderRadius={2} border="solid">
      <CardBody>
        <Stack direction="row">
          <Stack direction="column">
            <Heading>1 {name}</Heading>
            <Text>Sold by {buyer}</Text>
          </Stack>
          <Spacer />
          <Button>Sell for {price}</Button>
        </Stack>
      </CardBody>

      <CardFooter></CardFooter>
    </Card>
  );
};
